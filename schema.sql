CREATE TABLE IF NOT EXISTS employees (
    id           INTEGER   PRIMARY KEY AUTOINCREMENT,
    name         TEXT      NOT NULL,
    email        TEXT,
    role         TEXT      DEFAULT 'Staff',
    color        TEXT      DEFAULT '#4f46e5',
    hourly_pay   REAL      DEFAULT 0,
    calendar_id  TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shifts (
    id               INTEGER   PRIMARY KEY AUTOINCREMENT,
    employee_id      INTEGER   NOT NULL,
    date             TEXT      NOT NULL,
    start_time       TEXT      NOT NULL,
    end_time         TEXT      NOT NULL,
    notes            TEXT,
    calendar_event_id TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Seed employees if none exist
INSERT OR IGNORE INTO employees (id, name, email, role, color, hourly_pay) VALUES
(1, 'Alice Johnson', 'alice@clinic.com', 'Support Worker', '#4f46e5', 0),
(2, 'Bob Smith',     'bob@clinic.com',   'Support Worker', '#0891b2', 0),
(3, 'Carol White',   'carol@clinic.com', 'Receptionist',   '#059669', 0),
(4, 'David Brown',   'david@clinic.com', 'Support Worker', '#d97706', 0),
(5, 'Emma Davis',    'emma@clinic.com',  'Support Worker', '#dc2626', 0),
(6, 'Frank Miller',  'frank@clinic.com', 'Auditor',        '#7c3aed', 0);
