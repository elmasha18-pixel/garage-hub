-- GarageHub v2: скрытие объектов, часы работы, напоминания, заявки владельцев.
-- Безопасно выполнять повторно.

-- Объекты: скрытие вместо удаления и часы для слотов бронирования
ALTER TABLE garages ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS open_hour  int     NOT NULL DEFAULT 9;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS close_hour int     NOT NULL DEFAULT 22;

-- Заявки: отметки об отправленных напоминаниях
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_reminded       boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_wait_notified boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS visit_reminded       boolean NOT NULL DEFAULT false;

-- Заявки владельцев на размещение
CREATE TABLE IF NOT EXISTS owner_requests (
    id                bigserial PRIMARY KEY,
    name              text,
    phone             text,
    object_type       text,
    address           text,
    telegram_id       bigint,
    telegram_username text,
    status            text NOT NULL DEFAULT 'new',
    created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE owner_requests ENABLE ROW LEVEL SECURITY;
