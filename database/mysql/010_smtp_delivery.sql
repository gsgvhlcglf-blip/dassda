-- Future Hostinger MySQL adapter delivery rules, no live connection is configured.
-- Frozen email_payload.provider is smtp or resend. Legacy frozen payloads belong to resend.
-- Expired sending SMTP leases and EMAIL_SMTP_RESULT_UNKNOWN must become review;
-- never claim them automatically. SMTP Message-ID is stable, but not an idempotency API.
-- Explicit SMTP 4xx rejects may retry; 5xx/auth/TLS failures require configuration review.
-- EMAIL_PROVIDER_CHANGED also requires review, preserving the frozen provider.
-- Block generic retry of ambiguous SMTP outcomes until the operator reconciles server logs.
INSERT INTO schema_migrations(version) VALUES ('010_smtp_delivery');
