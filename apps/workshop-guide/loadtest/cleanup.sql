-- Removes every row written by the load test (participants load.NN and load.trainer, including
-- the trainer's __unlock rows). Only @example.com test identities match; real users are untouched.
DELETE FROM retailhub_trainer.default.workshop_progress
WHERE lower(user_email) LIKE 'load.%@example.com';
