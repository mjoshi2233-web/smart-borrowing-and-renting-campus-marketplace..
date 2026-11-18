INSERT INTO categories (name, icon) VALUES
    ('Study', 'book-open'),
    ('Electronics', 'laptop'),
    ('Books', 'book'),
    ('Sports', 'trophy'),
    ('Lab', 'flask-conical'),
    ('Other', 'package')
ON DUPLICATE KEY UPDATE icon = VALUES(icon);

INSERT INTO users (full_name, university_email, password_hash)
VALUES (
    'Aarav Sharma',
    'demo@borrowloop.test',
    '$2b$12$leau/0ZeFRSje32v56zBOOLHg3mIRN5ZSm6scFS1ADObB.LTLM4vi'
)
ON DUPLICATE KEY UPDATE university_email = VALUES(university_email);

INSERT INTO listings
    (owner_id, category_id, title, description, condition_name, price_per_day, image_path)
SELECT owner.id, category.id, seed.title, seed.description, seed.item_condition, seed.price_per_day, seed.image_path
FROM users AS owner
JOIN (
    SELECT 'Casio scientific calculator' AS title, 'Study' AS category_name,
           'Reliable scientific calculator, ideal for class and exam prep. Pickup near the main library.' AS description,
           'Good' AS item_condition, 10.00 AS price_per_day,
           'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=900&q=85' AS image_path
    UNION ALL SELECT 'Noise-cancelling headphones', 'Electronics',
           'Comfortable over-ear headphones for a focused study session. Please return them in the case.',
           'Good', 0.00, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85'
    UNION ALL SELECT 'Introduction to Algorithms', 'Books',
           'Fourth edition in good condition, with a few neat pencil notes.',
           'Fair', 15.00, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=85'
    UNION ALL SELECT 'DSLR camera with 50mm lens', 'Electronics',
           'Entry-level DSLR with a 50mm lens and carry bag. Handy for campus events.',
           'Good', 150.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85'
    UNION ALL SELECT 'Badminton racket pair', 'Sports',
           'Two lightweight rackets for a friendly game. Shuttlecocks included while supplies last.',
           'Good', 20.00, 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85'
    UNION ALL SELECT 'Laptop stand', 'Study',
           'Foldable aluminium laptop stand for a more comfortable study session.',
           'Like new', 0.00, 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=900&q=85'
) AS seed
JOIN categories AS category ON category.name = seed.category_name
WHERE owner.university_email = 'demo@borrowloop.test'
  AND NOT EXISTS (
      SELECT 1 FROM listings AS existing
      WHERE existing.owner_id = owner.id AND existing.title = seed.title
  );
