# Quatro Scripts

One-off scripts for things like data migrations

## Instructions

1. Set up environment variables in `.env`, copying the distribution file and filling out empty ones.

   ```sh
   cp .env.dist .env
   ```

1. Get the private admin API credentials, and place them in this document. To alernate between environments, you can change the filename used in `.env` for the credential.

1. Install dependencies

   ```sh
   npm install
   ```

1. Run the script you want

   ```sh
   npm start scripts/helloWorld
   npm start scripts/moveUsersToActiveCampaign
   ```
