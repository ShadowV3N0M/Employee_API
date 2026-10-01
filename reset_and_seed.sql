-- ====================================================================
-- Database Reset & Seed Script for 'userdb' (MySQL)
-- ====================================================================

USE userdb;

-- 1. Temporarily disable foreign key constraints
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Clear all existing data from tables
TRUNCATE TABLE `password_reset_token`;
TRUNCATE TABLE `salary_history`;
-- TRUNCATE TABLE `employee`;
TRUNCATE TABLE `department`;
TRUNCATE TABLE `user`;

-- 3. Re-enable foreign key constraints
SET FOREIGN_KEY_CHECKS = 1;

-- 4. Ensure user table has the email column
-- (Run this if you haven't run Alembic migration yet)
SET @exist := (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = 'userdb' 
      AND table_name = 'user' 
      AND column_name = 'email'
);
SET @sql := IF(@exist = 0, 'ALTER TABLE `user` ADD COLUMN `email` VARCHAR(100) UNIQUE NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Insert Sample Departments
INSERT INTO `department` (`Dept_ID`, `Dept_Name`, `Budget`) VALUES
(1, 'Engineering', 6500000.00),
(2, 'Human Resources', 1800000.00),
(3, 'Finance', 3200000.00),
(4, 'Marketing', 2500000.00),
(5, 'Sales', 4000000.00),
(6, 'Customer Support', 1500000.00),
(7, 'Research & Development', 5000000.00),
(8, 'IT Services', 2200000.00),
(9, 'Legal', 1200000.00),
(10, 'Operations', 3000000.00),
(11, 'Product Management', 2800000.00),
(12, 'Quality Assurance', 2000000.00),
(13, 'Business Development', 3500000.00),
(14, 'Public Relations', 1700000.00),
(15, 'Logistics', 1900000.00),
(16, 'Procurement', 2100000.00),
(17, 'Training & Development', 1600000.00),
(18, 'Compliance', 1400000.00),
(19, 'Facilities Management', 1300000.00),
(20, 'Strategy & Planning', 2400000.00),
(21, 'AI & Machine Learning', 4500000.00),
(22, 'Data Analytics', 3000000.00),
(23, 'Cybersecurity', 2800000.00),
(24, 'Cloud Services', 3200000.00),
(25, 'Mobile Development', 2700000.00);

-- 6. Insert Sample Employees
INSERT INTO `employee` (`Emp_ID`, `F_Name`, `L_Name`, `Salary`, `Dept_ID`, `Address`, `Email`, `is_active`) VALUES
(101, 'Sagar', 'Pokhariyal', 95000.00, 1, '101 Tech Boulevard', 'sagar.p@laesfera.co', 1),
(102, 'Aarav', 'Sharma', 82000.00, 1, '204 Silicon Valley Rd', 'aarav.s@laesfera.co', 1),
(103, 'Priya', 'Patel', 75000.00, 2, '12 Corporate Way', 'priya.p@laesfera.co', 1),
(104, 'Rohit', 'Verma', 68000.00, 3, '88 Finance Plaza', 'rohit.v@laesfera.co', 1),
(105, 'Ananya', 'Iyer', 62000.00, 4, '45 Market Street', 'ananya.i@laesfera.co', 1);

-- Note on Users:
-- Passwords must be hashed with bcrypt to authenticate through the API.
-- Run 'python seed_data.py' from the employee_api folder to automatically
-- insert users with live, verified bcrypt hashes.
