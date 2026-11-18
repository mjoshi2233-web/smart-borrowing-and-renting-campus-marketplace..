CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    university_email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (role IN ('student', 'admin'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    icon VARCHAR(50) NOT NULL DEFAULT 'package'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS listings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    condition_name VARCHAR(30) NOT NULL DEFAULT 'Good',
    price_per_day DECIMAL(10, 2) NOT NULL DEFAULT 0,
    image_path VARCHAR(1000) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT listings_condition_check CHECK (condition_name IN ('Like new', 'Good', 'Fair')),
    CONSTRAINT listings_price_check CHECK (price_per_day >= 0),
    CONSTRAINT listings_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT listings_category_fk FOREIGN KEY (category_id) REFERENCES categories(id),
    INDEX listings_available_created_idx (is_available, created_at),
    INDEX listings_category_available_idx (category_id, is_available),
    INDEX listings_owner_idx (owner_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS borrow_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    listing_id BIGINT UNSIGNED NOT NULL,
    borrower_id BIGINT UNSIGNED NOT NULL,
    request_from DATE NOT NULL,
    request_to DATE NOT NULL,
    message VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT borrow_requests_status_check CHECK (status IN ('pending', 'approved', 'declined', 'cancelled', 'returned')),
    CONSTRAINT borrow_requests_dates_check CHECK (request_to >= request_from),
    CONSTRAINT borrow_requests_listing_fk FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    CONSTRAINT borrow_requests_borrower_fk FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX borrow_requests_listing_dates_idx (listing_id, status, request_from, request_to),
    INDEX borrow_requests_borrower_idx (borrower_id, created_at)
) ENGINE=InnoDB;
