"""WebSocket Connection Manager and Push Notification Dispatch Service."""
import asyncio
from collections import defaultdict
from datetime import datetime
import json
import logging
from typing import Dict, List, Optional, Set
from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.models.notification import NotificationDB
from app.models.user import UserDB

logger = logging.getLogger("notifications")


def format_time_ago(dt: datetime) -> str:
    """Format datetime into human-friendly relative time string."""
    if not dt:
        return "Just now"
    now = datetime.utcnow()
    diff = now - dt
    seconds = int(diff.total_seconds())

    if seconds < 10:
        return "Just now"
    if seconds < 60:
        return f"{seconds}s ago"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days < 7:
        return f"{days}d ago"
    return dt.strftime("%b %d")


class WebSocketManager:
    """Manages active WebSocket connections grouped by user ID."""

    def __init__(self):
        # Maps user_id -> set of active WebSockets (supports multi-tab / multi-device)
        self.active_connections: Dict[int, Set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id].add(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Active sockets for user: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")

    async def send_to_user(self, user_id: int, message: dict):
        """Send message to all active WebSocket connections for a given user."""
        sockets = list(self.active_connections.get(user_id, set()))
        if not sockets:
            return
        dead_sockets = []
        payload = json.dumps(message)
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send to user {user_id} socket: {e}")
                dead_sockets.append(ws)
        for dead in dead_sockets:
            self.disconnect(dead, user_id)

    async def broadcast_to_users(self, user_ids: List[int], message_builder):
        """
        Send a notification to a list of users.
        message_builder can be a dict or a callable (user_id -> dict).
        """
        for uid in user_ids:
            msg = message_builder(uid) if callable(message_builder) else message_builder
            await self.send_to_user(uid, msg)

    async def broadcast_all(self, message: dict):
        """Broadcast raw message to every active connection."""
        for uid in list(self.active_connections.keys()):
            await self.send_to_user(uid, message)


# Global singleton manager
ws_manager = WebSocketManager()


def dispatch_notification(
    db: Session,
    title: str,
    message: str,
    type: str = "info",
    link: Optional[str] = None,
    user_id: Optional[int] = None,
    role: Optional[str] = None,
    broadcast: bool = False,
) -> List[NotificationDB]:
    """
    Creates notification record(s) in database for the target audience
    and immediately pushes a real-time event to all active WebSocket connections.
    """
    target_users: List[UserDB] = []

    if user_id is not None:
        user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.is_active == True).first()
        if user:
            target_users = [user]
    elif role is not None:
        target_users = (
            db.query(UserDB)
            .filter(UserDB.role == role, UserDB.is_active == True)
            .all()
        )
    elif broadcast:
        target_users = db.query(UserDB).filter(UserDB.is_active == True).all()
    else:
        # Default broadcast to all active users
        target_users = db.query(UserDB).filter(UserDB.is_active == True).all()

    if not target_users:
        return []

    created_notifications: List[NotificationDB] = []
    user_notif_map: Dict[int, NotificationDB] = {}

    for u in target_users:
        notif = NotificationDB(
            user_id=u.id,
            title=title,
            message=message,
            type=type,
            link=link,
            is_read=False,
            created_at=datetime.utcnow(),
        )
        db.add(notif)
        created_notifications.append(notif)

    db.commit()

    for notif in created_notifications:
        db.refresh(notif)
        user_notif_map[notif.user_id] = notif

    # Dispatch to WebSockets asynchronously
    def get_user_payload(uid: int) -> dict:
        notif = user_notif_map.get(uid)
        return {
            "type": "new_notification",
            "notification": {
                "id": notif.id if notif else None,
                "user_id": uid,
                "title": title,
                "message": message,
                "type": type,
                "link": link,
                "is_read": False,
                "created_at": notif.created_at.isoformat() if notif else datetime.utcnow().isoformat(),
                "time_ago": "Just now",
            },
        }

    target_uids = [u.id for u in target_users]

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(ws_manager.broadcast_to_users(target_uids, get_user_payload))
    except RuntimeError:
        # No running event loop in thread; create background task via asyncio.run
        try:
            asyncio.run(ws_manager.broadcast_to_users(target_uids, get_user_payload))
        except Exception as e:
            logger.warning(f"Error dispatching websocket push: {e}")

    return created_notifications
