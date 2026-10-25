# Business & Management Test Website

This repository is designed for:

- **Frontend:** GitHub Pages (`docs/`)
- **Secure grading:** Firebase Cloud Function
- **Immutable-from-the-student-site results:** Firestore
- **Questions:** 52 questions imported from the three supplied CSV files

## Security design

The answer key is **not inside the GitHub Pages frontend**. The browser receives only question text and choices. When a student submits, the Firebase function calculates the score on the server and creates a Firestore document.

A submission document ID is derived from `testId + Student ID`. The backend uses a Firestore transaction and refuses to overwrite an existing submission. Firestore security rules deny all direct browser reads/writes.

This prevents a student from editing a score through the website or directly through Firestore. As with every hosted system, the Firebase project owner/admin still controls the database.

## 1. Create Firebase backend

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable **Firestore Database**.
3. Install Node.js and Firebase CLI:
   `npm install -g firebase-tools`
4. From this project folder:
   `firebase login`
5. Associate this folder with your Firebase project:
   `firebase use --add`
6. Install function dependencies:
   `cd functions`
   `npm install`
   `cd ..`
7. Deploy:
   `firebase deploy --only functions,firestore:rules`

After deployment Firebase prints a function URL similar to:

`https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api`

## 2. Connect the frontend

Edit:

`docs/config.js`

Replace:

`PASTE_YOUR_FIREBASE_FUNCTION_URL_HERE`

with the function URL from Firebase.

## 3. Publish with GitHub Pages

1. Create a GitHub repository, e.g. `business-test`.
2. Push this whole folder to the repository.
3. GitHub repository → **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch and `/docs` folder.
6. Save.

Your public URL will look like:

`https://YOUR-USERNAME.github.io/business-test/`

## Student behavior

- Student enters name and Student ID.
- Student selects one of the three tests.
- The site downloads questions **without answer keys**.
- Student submits answers.
- Server grades them and saves the result.
- The result is displayed.
- A second submission with the same Student ID for the same test receives HTTP `409` and is rejected.

## Viewing results

Open Firebase Console → Firestore Database → `submissions`.

Each document contains Student ID, name, test, answers, score, percentage, and server timestamp.

## Important

Do not put `functions/questions.json` inside `docs/`. `docs/` is public. The `functions/` directory is deployed to the backend and contains the answer key.
