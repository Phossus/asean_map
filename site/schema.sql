-- ASEAN MAP database schema (MariaDB). Run with:  sudo mariadb < schema.sql
CREATE DATABASE IF NOT EXISTS asean_map CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE asean_map;

CREATE TABLE IF NOT EXISTS countries (
  id        TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  iso_code  CHAR(2)      NOT NULL UNIQUE,
  name      VARCHAR(80)  NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS brands (
  id        SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(80)  NOT NULL UNIQUE,
  logo_url  VARCHAR(500) NULL
) ENGINE=InnoDB;

-- The four scoring areas shown on every rating card.
CREATE TABLE IF NOT EXISTS pillars (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  name        VARCHAR(80) NOT NULL,
  max_score   DECIMAL(4,2) NULL,          -- fill in from the programme's assessment details
  sort_order  TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS motorcycles (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  brand_id    SMALLINT UNSIGNED NOT NULL,
  country_id  TINYINT UNSIGNED  NOT NULL,
  model       VARCHAR(120) NOT NULL,
  model_year  SMALLINT UNSIGNED NULL,
  rating_date DATE NULL COMMENT 'Official assessment/publication date; do not use updated_at for rating chronology',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when the motorcycle record was first added',
  engine_cc   SMALLINT UNSIGNED NULL,
  stars       TINYINT UNSIGNED NULL,
  is_new      BOOLEAN NOT NULL DEFAULT FALSE,
  image       LONGBLOB NULL,          -- the photo itself
  image_mime  VARCHAR(50) NULL,           -- image/png, image/jpeg or image/webp
  report_pdf  LONGBLOB NULL,              -- the PDF report itself
  report_url  VARCHAR(500) NULL,
  source_url  VARCHAR(500) NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_motorcycle (brand_id, model, model_year),
  KEY idx_year (model_year),
  KEY idx_rating_date (rating_date),
  KEY idx_created_at (created_at),
  KEY idx_stars (stars),
  CONSTRAINT fk_moto_brand   FOREIGN KEY (brand_id)   REFERENCES brands(id),
  CONSTRAINT fk_moto_country FOREIGN KEY (country_id) REFERENCES countries(id),
  CONSTRAINT chk_stars CHECK (stars IS NULL OR stars BETWEEN 0 AND 5)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS motorcycle_scores (
  motorcycle_id INT UNSIGNED NOT NULL,
  pillar_id     TINYINT UNSIGNED NOT NULL,
  score         DECIMAL(4,2) NOT NULL,
  PRIMARY KEY (motorcycle_id, pillar_id),
  CONSTRAINT fk_score_moto   FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_score_pillar FOREIGN KEY (pillar_id)     REFERENCES pillars(id)
) ENGINE=InnoDB;

-- Upgrade existing installations. The checks make this safe to run more than once.
-- Existing rows keep rating_date = NULL until their real official assessment dates are entered.
DELIMITER //
DROP PROCEDURE IF EXISTS migrate_motorcycle_rating_date//
CREATE PROCEDURE migrate_motorcycle_rating_date()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'motorcycles'
      AND COLUMN_NAME = 'rating_date'
  ) THEN
    ALTER TABLE motorcycles
      ADD COLUMN rating_date DATE NULL
      COMMENT 'Official assessment/publication date; do not use updated_at for rating chronology'
      AFTER model_year;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'motorcycles'
      AND INDEX_NAME = 'idx_rating_date'
  ) THEN
    ALTER TABLE motorcycles ADD KEY idx_rating_date (rating_date);
  END IF;
END//
CALL migrate_motorcycle_rating_date()//
DROP PROCEDURE migrate_motorcycle_rating_date//
DELIMITER ;


-- Upgrade existing installations with a stable record-creation timestamp.
-- Existing rows are backfilled from updated_at only once as a best-available estimate.
DELIMITER //
DROP PROCEDURE IF EXISTS migrate_motorcycle_created_at//
CREATE PROCEDURE migrate_motorcycle_created_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'motorcycles'
      AND COLUMN_NAME = 'created_at'
  ) THEN
    ALTER TABLE motorcycles ADD COLUMN created_at DATETIME NULL DEFAULT NULL AFTER rating_date;
  END IF;

  UPDATE motorcycles SET created_at = updated_at WHERE created_at IS NULL;
  ALTER TABLE motorcycles
    MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'Timestamp when the motorcycle record was first added';

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'motorcycles'
      AND INDEX_NAME = 'idx_created_at'
  ) THEN
    ALTER TABLE motorcycles ADD KEY idx_created_at (created_at);
  END IF;
END//
CALL migrate_motorcycle_created_at()//
DROP PROCEDURE migrate_motorcycle_created_at//
DELIMITER ;

INSERT IGNORE INTO countries (iso_code, name) VALUES ('MY', 'Malaysia');
INSERT IGNORE INTO pillars (code, name, sort_order) VALUES
  ('UN_REG', 'UN Regulations', 1),
  ('COP', 'Conformity of Production', 2),
  ('SAFETY_TECH', 'Safety Technology', 3),
  ('SUPPORT', 'Support Programme', 4);

CREATE TABLE IF NOT EXISTS motorcycle_specs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  motorcycle_id INT UNSIGNED NOT NULL,
  label         VARCHAR(80)  NOT NULL,
  value         VARCHAR(200) NOT NULL,
  sort_order    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_specs_moto (motorcycle_id),
  CONSTRAINT fk_spec_moto FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS motorcycle_features (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  motorcycle_id INT UNSIGNED NOT NULL,
  category      VARCHAR(80)  NOT NULL,
  feature       VARCHAR(120) NOT NULL,
  availability  ENUM('standard','optional','not_available') NOT NULL DEFAULT 'standard',
  sort_order    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_features_moto (motorcycle_id),
  CONSTRAINT fk_feature_moto FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One row per motorcycle, shaped exactly like the website's rating card.
CREATE OR REPLACE VIEW v_rating_cards AS
SELECT m.id, b.name AS brand, m.model, m.model_year, m.rating_date, m.created_at, m.engine_cc, m.stars, m.is_new,
       MAX(m.image IS NOT NULL) AS has_image,      -- the photo bytes are NOT in this view (served by the API)
       MAX(m.updated_at) AS updated_at,
       b.logo_url AS brand_logo_url, m.report_url, c.name AS country,
       MAX(CASE WHEN p.code = 'UN_REG'      THEN s.score END) AS un_regulations,
       MAX(CASE WHEN p.code = 'COP'         THEN s.score END) AS conformity_of_production,
       MAX(CASE WHEN p.code = 'SAFETY_TECH' THEN s.score END) AS safety_technology,
       MAX(CASE WHEN p.code = 'SUPPORT'     THEN s.score END) AS support_programme,
       SUM(s.score) AS total_score
FROM motorcycles m
JOIN brands b    ON b.id = m.brand_id
JOIN countries c ON c.id = m.country_id
LEFT JOIN motorcycle_scores s ON s.motorcycle_id = m.id
LEFT JOIN pillars p ON p.id = s.pillar_id
GROUP BY m.id, b.name, m.model, m.model_year, m.rating_date, m.created_at, m.engine_cc, m.stars, m.is_new,
         b.logo_url, m.report_url, c.name;
