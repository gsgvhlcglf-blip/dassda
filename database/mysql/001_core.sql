-- Prepared schema for MySQL 8.0.16+ (enforced CHECK constraints), InnoDB.
-- No connection, customer data or commercial inventory is created by this file.
-- Apply once to a NEW database during the future integration stage.
-- MariaDB requires its own compatibility verification before applying.
SET NAMES utf8mb4;

CREATE TABLE schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email_verified_at DATETIME(3),
  disabled_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE customers (
  id CHAR(36) PRIMARY KEY,
  CONSTRAINT customer_user FOREIGN KEY (id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE admin_users (
  user_id CHAR(36) PRIMARY KEY,
  role VARCHAR(10) NOT NULL,
  CONSTRAINT admin_user FOREIGN KEY (user_id) REFERENCES users(id),
  CHECK (role IN ('admin','editor'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE auth_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash BINARY(32) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3),
  CONSTRAINT session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX session_expiry (expires_at), INDEX session_owner (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE auth_tokens (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL,
  purpose VARCHAR(20) NOT NULL, token_hash BINARY(32) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL, consumed_at DATETIME(3),
  CONSTRAINT auth_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (purpose IN ('verify_email','reset_password')),
  INDEX auth_token_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE brands (
  id VARCHAR(100) PRIMARY KEY, slug VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL, position INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE models (
  id VARCHAR(100) PRIMARY KEY, brand_id VARCHAR(100) NOT NULL,
  slug VARCHAR(128) NOT NULL, name VARCHAR(200) NOT NULL,
  image TEXT NOT NULL, published BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT model_brand FOREIGN KEY (brand_id) REFERENCES brands(id),
  UNIQUE KEY model_slug (brand_id,slug), INDEX model_visibility (brand_id,published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE generations (
  id VARCHAR(100) PRIMARY KEY, model_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL, start_year SMALLINT NOT NULL, end_year SMALLINT NOT NULL,
  CONSTRAINT generation_model FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
  UNIQUE KEY generation_owner (id,model_id),
  CHECK (start_year <= end_year), CHECK (start_year >= 1900 AND end_year <= 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE model_years (
  id VARCHAR(100) PRIMARY KEY, model_id VARCHAR(100) NOT NULL,
  generation_id VARCHAR(100) NOT NULL, year SMALLINT NOT NULL,
  CONSTRAINT year_model FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
  CONSTRAINT year_generation FOREIGN KEY (generation_id,model_id) REFERENCES generations(id,model_id) ON DELETE CASCADE,
  UNIQUE KEY model_year (model_id,year), CHECK (year BETWEEN 1900 AND 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE categories (
  id VARCHAR(100) PRIMARY KEY, slug VARCHAR(128) NOT NULL UNIQUE, name JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE products (
  id VARCHAR(100) PRIMARY KEY, slug VARCHAR(128) NOT NULL UNIQUE,
  sku VARCHAR(100) NOT NULL UNIQUE, category_id VARCHAR(100) NOT NULL,
  title JSON NOT NULL, description JSON NOT NULL, specifications JSON NOT NULL,
  installation JSON NOT NULL, material VARCHAR(30) NOT NULL,
  price DECIMAL(14,2) NOT NULL, stock INT NOT NULL DEFAULT 0,
  weight DECIMAL(12,3), featured BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE, demo BOOLEAN NOT NULL DEFAULT TRUE,
  video_url TEXT NOT NULL, viewer_url TEXT NOT NULL,
  CONSTRAINT product_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CHECK (price >= 0), CHECK (stock >= 0), CHECK (weight IS NULL OR weight >= 0),
  INDEX product_listing (published,category_id,price), INDEX product_featured (published,featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE variants (
  id VARCHAR(100) PRIMARY KEY, product_id VARCHAR(100) NOT NULL,
  name JSON NOT NULL, sku VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(14,2) NOT NULL, stock INT NOT NULL DEFAULT 0, finish VARCHAR(20) NOT NULL,
  CONSTRAINT variant_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY variant_owner (id,product_id), CHECK (price >= 0), CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE media_assets (
  id CHAR(36) PRIMARY KEY, storage_key VARCHAR(512) COLLATE utf8mb4_bin NOT NULL UNIQUE,
  mime VARCHAR(100) NOT NULL, bytes BIGINT UNSIGNED NOT NULL,
  visibility VARCHAR(10) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CHECK (visibility IN ('public','private'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE product_images (
  id VARCHAR(100) PRIMARY KEY, product_id VARCHAR(100) NOT NULL,
  media_id CHAR(36), url TEXT NOT NULL, alt JSON NOT NULL, position INT NOT NULL DEFAULT 0,
  CONSTRAINT image_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT image_media FOREIGN KEY (media_id) REFERENCES media_assets(id),
  INDEX product_image_order (product_id,position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE compatibility (
  id VARCHAR(100) PRIMARY KEY, product_id VARCHAR(100) NOT NULL,
  model_id VARCHAR(100) NOT NULL, generation_id VARCHAR(100),
  year_from SMALLINT NOT NULL, year_to SMALLINT NOT NULL,
  CONSTRAINT fitment_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fitment_model FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
  CONSTRAINT fitment_generation FOREIGN KEY (generation_id,model_id) REFERENCES generations(id,model_id) ON DELETE CASCADE,
  UNIQUE KEY fitment_unique (product_id,model_id,year_from,year_to),
  INDEX fitment_lookup (model_id,year_from,year_to,product_id),
  CHECK (year_from <= year_to), CHECK (year_from >= 1900 AND year_to <= 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE content (
  id VARCHAR(100) PRIMARY KEY, `key` VARCHAR(191) NOT NULL UNIQUE,
  title JSON NOT NULL, body JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id CHAR(36) PRIMARY KEY, reference VARCHAR(80) NOT NULL UNIQUE,
  customer_id CHAR(36) NOT NULL, customer_name VARCHAR(200) NOT NULL,
  email VARCHAR(254) NOT NULL, phone VARCHAR(50) NOT NULL,
  address TEXT NOT NULL, note TEXT NOT NULL, status VARCHAR(40) NOT NULL,
  total DECIMAL(14,2) NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'TRY',
  demo BOOLEAN NOT NULL DEFAULT TRUE, payment_status VARCHAR(40) NOT NULL DEFAULT 'request_only',
  payment_provider VARCHAR(20), paid_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT order_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CHECK (total >= 0), INDEX orders_customer (customer_id,created_at,id), INDEX orders_status (status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE order_items (
  id CHAR(36) PRIMARY KEY, order_id CHAR(36) NOT NULL,
  product_id VARCHAR(100) NOT NULL, variant_id VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL, sku VARCHAR(100) NOT NULL,
  quantity INT NOT NULL, unit_price DECIMAL(14,2) NOT NULL,
  CONSTRAINT item_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT item_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT item_variant FOREIGN KEY (variant_id,product_id) REFERENCES variants(id,product_id),
  CHECK (quantity BETWEEN 1 AND 99), CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE payment_settings (
  id VARCHAR(20) PRIMARY KEY, provider VARCHAR(20) NOT NULL DEFAULT 'none',
  mode VARCHAR(10) NOT NULL DEFAULT 'test', enabled BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (id = 'site'), CHECK (provider IN ('none','paytr','iyzico')), CHECK (mode IN ('test','live'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE payment_attempts (
  id CHAR(36) PRIMARY KEY, order_id CHAR(36) NOT NULL UNIQUE, customer_id CHAR(36) NOT NULL,
  provider VARCHAR(20) NOT NULL, mode VARCHAR(10) NOT NULL, state VARCHAR(20) NOT NULL,
  amount_minor BIGINT NOT NULL, currency CHAR(3) NOT NULL, merchant_ref VARCHAR(80) COLLATE utf8mb4_bin NOT NULL UNIQUE,
  token VARCHAR(512) COLLATE utf8mb4_bin UNIQUE, checkout_url TEXT, provider_payment_id VARCHAR(160),
  reserved BOOLEAN NOT NULL DEFAULT FALSE, error_code VARCHAR(100),
  created_at DATETIME(3) NOT NULL, expires_at DATETIME(3) NOT NULL,
  CONSTRAINT payment_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT payment_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CHECK (amount_minor > 0), CHECK (mode IN ('test','live')),
  INDEX payment_expiry (state,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE payment_events (
  id CHAR(36) PRIMARY KEY, attempt_id CHAR(36) NOT NULL, kind VARCHAR(50) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT payment_event_attempt FOREIGN KEY (attempt_id) REFERENCES payment_attempts(id),
  INDEX payment_event_time (attempt_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crm_contacts (
  id CHAR(36) PRIMARY KEY, customer_id CHAR(36), name VARCHAR(200) NOT NULL,
  email VARCHAR(254) NOT NULL, phone VARCHAR(50) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT contact_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX contact_email (email), INDEX contact_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE work_terms_versions (
  version INT PRIMARY KEY, body JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE work_requests (
  id CHAR(36) PRIMARY KEY, reference VARCHAR(80) NOT NULL UNIQUE,
  submission_key CHAR(36) NOT NULL UNIQUE, fingerprint CHAR(64) NOT NULL,
  source_hash CHAR(64) NOT NULL, contact_id CHAR(36) NOT NULL, customer_id CHAR(36),
  kind VARCHAR(10) NOT NULL, status VARCHAR(40) NOT NULL, revision INT NOT NULL DEFAULT 1,
  brand_name VARCHAR(200) NOT NULL, model_name VARCHAR(200) NOT NULL, year SMALLINT NOT NULL,
  length_cm DECIMAL(12,2) NOT NULL, width_cm DECIMAL(12,2) NOT NULL,
  material VARCHAR(30) NOT NULL, manufacturing_method VARCHAR(30) NOT NULL,
  part_description TEXT NOT NULL, input JSON NOT NULL, resolved JSON NOT NULL,
  operations JSON NOT NULL, technical_review BOOLEAN NOT NULL DEFAULT FALSE,
  demo BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
  CONSTRAINT request_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id),
  CONSTRAINT request_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CHECK (kind IN ('demand','custom')), CHECK (revision > 0),
  CHECK (year BETWEEN 1900 AND 2100), CHECK (length_cm > 0 AND width_cm > 0),
  INDEX request_stage (kind,status,created_at,id), INDEX request_model (brand_name,model_name,year),
  INDEX request_time (created_at,id), INDEX request_customer (customer_id,created_at),
  INDEX request_source (source_hash,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE work_request_events (
  id CHAR(36) PRIMARY KEY, request_id CHAR(36) NOT NULL,
  actor VARCHAR(100) NOT NULL, type VARCHAR(50) NOT NULL,
  from_status VARCHAR(40) NOT NULL, to_status VARCHAR(40) NOT NULL,
  note TEXT NOT NULL, detail JSON NOT NULL, created_at DATETIME(3) NOT NULL,
  CONSTRAINT event_request FOREIGN KEY (request_id) REFERENCES work_requests(id),
  INDEX request_event_time (request_id,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE work_request_files (
  id CHAR(36) PRIMARY KEY, request_id CHAR(36) NOT NULL, media_id CHAR(36) NOT NULL,
  kind VARCHAR(20) NOT NULL, name VARCHAR(255) NOT NULL,
  CONSTRAINT file_request FOREIGN KEY (request_id) REFERENCES work_requests(id),
  CONSTRAINT file_media FOREIGN KEY (media_id) REFERENCES media_assets(id),
  CHECK (kind IN ('customer','received'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE work_request_quotes (
  id CHAR(36) PRIMARY KEY, request_id CHAR(36) NOT NULL, body JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT quote_request FOREIGN KEY (request_id) REFERENCES work_requests(id),
  INDEX quote_time (request_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE work_request_consents (
  request_id CHAR(36) NOT NULL, terms_key VARCHAR(30) NOT NULL, version INT NOT NULL,
  text_snapshot TEXT NOT NULL, accepted_at DATETIME(3) NOT NULL,
  PRIMARY KEY (request_id,terms_key,version),
  CONSTRAINT consent_request FOREIGN KEY (request_id) REFERENCES work_requests(id),
  CONSTRAINT consent_terms FOREIGN KEY (version) REFERENCES work_terms_versions(version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE analytics_settings (
  id VARCHAR(20) PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE,
  retention_days INT NOT NULL DEFAULT 30,
  CHECK (id = 'site'), CHECK (retention_days IN (7,30,90))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE analytics_events (
  id CHAR(36) PRIMARY KEY, session_id VARCHAR(100) NOT NULL, kind VARCHAR(20) NOT NULL,
  path VARCHAR(1024) NOT NULL, viewport_width INT NOT NULL, viewport_height INT NOT NULL,
  document_width INT NOT NULL, document_height INT NOT NULL,
  x DECIMAL(12,4), y DECIMAL(12,4), depth DECIMAL(6,3),
  referrer_host VARCHAR(254) NOT NULL, revision VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CHECK (kind IN ('pageview','click','scroll','cart_add')),
  INDEX analytics_time (created_at), INDEX analytics_session (session_id,created_at),
  INDEX analytics_screen (path(191),viewport_width,viewport_height,revision,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE site_workspace (
  id VARCHAR(20) PRIMARY KEY, revision INT NOT NULL,
  catalog JSON NOT NULL, design JSON NOT NULL, published_id CHAR(36),
  CHECK (id = 'site'), CHECK (revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE site_versions (
  id CHAR(36) PRIMARY KEY, created_at DATETIME(3) NOT NULL,
  label VARCHAR(200) NOT NULL, kind VARCHAR(30) NOT NULL,
  catalog JSON NOT NULL, design JSON NOT NULL,
  INDEX site_version_time (created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE site_presentation (
  id VARCHAR(20) PRIMARY KEY, design JSON NOT NULL, CHECK (id = 'site')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations(version) VALUES ('001_core');
