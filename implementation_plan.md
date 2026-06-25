# Fix Login Errors

The user reported receiving a `401 Unauthorized` followed by a `500 Internal Server Error` when trying to log in.

## Findings
1. **500 Internal Server Error:** This occurs when the Next.js application fails to connect to the PostgreSQL database (`ECONNREFUSED`), or if the database is missing its tables (e.g., in a fresh Docker volume). The generic 500 error masks the actual database connection failure.
2. **401 Unauthorized:** This occurs when the wrong password is provided. 
3. **Hidden 400 Bad Request:** The `admin` password in the database is `admin` (5 characters). However, the `api/auth/login/route.ts` file enforces a minimum of 8 characters. If you type the correct `admin` password, the server rejects it before even checking the database.

## Proposed Changes

### [MODIFY] src/app/api/auth/login/route.ts
- **Lower password length requirement:** Change the minimum password length check from 8 characters to 4 characters. This will allow legacy passwords like `admin` to work without being blocked.
- **Improve Error Handling:** Keep the rate limiter intact, but ensure that database connection errors return a more descriptive message (e.g., "Database connection failed") instead of a generic 500 error.

### [MODIFY] package.json / start.sh (Optional)
- Add a script to automatically run database migrations if they haven't been applied, ensuring the Docker setup works out-of-the-box.

## User Review Required
> [!IMPORTANT]
> The database connection failed during your local testing, likely because the `latuns_db` Docker container was not running, or it was shut down before Next.js could query it. To run locally, you must ensure `docker-compose up -d db` is running in the background.

Please review the proposed changes to the login route so we can fix the authentication flow.
