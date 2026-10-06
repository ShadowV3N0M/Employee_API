"""Real-time push notifications router and WebSocket endpoint."""
from datetime import datetime
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_manager_or_admin
from app.config import ALGORITHM, SECRET_KEY, limiter
from app.database import SessionLocal, get_db
from app.models.notification import NotificationDB
from app.models.user import UserDB
from app.schemas.notification import (
    MarkAllReadResponse,
    NotificationCreate,
    NotificationOut,
    UnreadCountResponse,
)
from app.services.notification_service import (
    dispatch_notification,
    format_time_ago,
    ws_manager,
)

logger = logging.getLogger("notifications")

router = APIRouter(tags=["Push Notifications & WebSockets"])


def _to_out(n: NotificationDB) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        user_id=n.user_id,
        title=n.title,
        message=n.message,
        type=n.type,
        link=n.link,
        is_read=n.is_read,
        created_at=n.created_at,
        time_ago=format_time_ago(n.created_at),
    )


# =========================================================================
# WebSocket Real-Time Endpoint
# =========================================================================

@router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for real-time notification push.
    Authenticates via JWT token query parameter `?token=...`.
    """
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Authenticate token
    db: Session = SessionLocal()
    try:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if not username:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        except JWTError:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user = db.query(UserDB).filter(UserDB.username == username, UserDB.is_active == True).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id = user.id
        username_val = user.username
        role_val = user.role

        # Count unread notifications
        unread_count = (
            db.query(NotificationDB)
            .filter(NotificationDB.user_id == user_id, NotificationDB.is_read == False)
            .count()
        )
    finally:
        db.close()

    # Accept connection and register into manager
    await ws_manager.connect(websocket, user_id)

    # Send initial welcome state with unread count
    init_payload = {
        "type": "init",
        "unread_count": unread_count,
        "user": {
            "id": user_id,
            "username": username_val,
            "role": role_val,
        },
    }
    await websocket.send_text(json.dumps(init_payload))

    try:
        while True:
            data = await websocket.receive_text()
            # Handle client heartbeat or ping
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.warning(f"WebSocket error for user {user_id}: {e}")
        ws_manager.disconnect(websocket, user_id)


# =========================================================================
# REST Endpoints for Notification History & Inbox Management
# =========================================================================

@router.get("/notifications", response_model=List[NotificationOut])
@limiter.limit("60/minute")
def list_notifications(
    request: Request,
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    limit: int = Query(50, ge=1, le=100, description="Max notifications to retrieve"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Retrieve notifications for the current authenticated user."""
    query = db.query(NotificationDB).filter(NotificationDB.user_id == current_user.id)
    if unread_only:
        query = query.filter(NotificationDB.is_read == False)

    notifications = query.order_by(NotificationDB.created_at.desc()).limit(limit).all()
    return [_to_out(n) for n in notifications]


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
@limiter.limit("120/minute")
def get_unread_count(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get the current count of unread notifications for badge counter."""
    count = (
        db.query(NotificationDB)
        .filter(NotificationDB.user_id == current_user.id, NotificationDB.is_read == False)
        .count()
    )
    return UnreadCountResponse(unread_count=count)


@router.patch("/notifications/{id}/read", response_model=NotificationOut)
@limiter.limit("60/minute")
def mark_notification_read(
    request: Request,
    id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    notif = (
        db.query(NotificationDB)
        .filter(NotificationDB.id == id, NotificationDB.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return _to_out(notif)


@router.patch("/notifications/mark-all-read", response_model=MarkAllReadResponse)
@limiter.limit("30/minute")
def mark_all_read(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Mark all unread notifications for the current user as read."""
    unread_items = (
        db.query(NotificationDB)
        .filter(NotificationDB.user_id == current_user.id, NotificationDB.is_read == False)
        .all()
    )
    count = len(unread_items)
    for item in unread_items:
        item.is_read = True
    db.commit()
    return MarkAllReadResponse(marked_count=count)


@router.delete("/notifications/{id}")
@limiter.limit("60/minute")
def delete_notification(
    request: Request,
    id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete / dismiss a specific notification."""
    notif = (
        db.query(NotificationDB)
        .filter(NotificationDB.id == id, NotificationDB.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notif)
    db.commit()
    return {"message": "Notification deleted successfully"}


@router.delete("/notifications/clear-all")
@limiter.limit("30/minute")
def clear_all_read(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Clear all already-read notifications from the user's inbox."""
    deleted_count = (
        db.query(NotificationDB)
        .filter(NotificationDB.user_id == current_user.id, NotificationDB.is_read == True)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"message": f"Cleared {deleted_count} read notifications"}


@router.post("/notifications/broadcast")
@limiter.limit("10/minute")
def broadcast_custom_notification(
    request: Request,
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin),
):
    """
    Managers and Admins can broadcast custom alerts or targeted notifications
    to all staff or a specific role with real-time push delivery.
    """
    created = dispatch_notification(
        db=db,
        title=payload.title,
        message=payload.message,
        type=payload.type,
        link=payload.link,
        user_id=payload.user_id,
        role=payload.role,
        broadcast=payload.broadcast if payload.broadcast else (payload.role is None and payload.user_id is None),
    )
    return {
        "message": "Notification dispatched successfully",
        "recipients_count": len(created),
    }
