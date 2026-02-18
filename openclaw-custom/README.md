# Mission Control Standalone

This folder is your fully standalone Mission Control app.

## Standalone Runtime (No conflict with original)

- Frontend: `http://localhost:3100`
- Backend: `http://localhost:8797`
- WebSocket: `ws://localhost:8797/ws/mission-control`

### Run custom standalone

```bash
npm install
npm run start:standalone
```

### Important

- This app runs on its own ports, isolated from any other dashboard.
- Environment defaults in `.env` and `.env.example` are already pointed to `8797`.
- Backend port can still be overridden via `PORT`.
- `MC_STANDALONE_MODE=true` keeps runtime fully self-contained.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Deployment (GitHub Pages)

This project is configured for GitHub Pages deployment.

### One-time setup

1. Ensure this repository is pushed to GitHub.
2. Confirm `package.json` has:
   - `"homepage": "https://nrogue19.github.io/Mission-Control"`
   - `predeploy` and `deploy` scripts using `gh-pages`

### Deploy

In the project folder run:

```bash
npm install
npm run deploy
```

This publishes the production `build/` folder to the `gh-pages` branch.

### GitHub Pages setting

In your GitHub repo:

1. Go to **Settings → Pages**
2. Set **Source** to **Deploy from a branch**
3. Select branch **gh-pages** and folder **/(root)**
4. Save and wait for the site URL to appear

Your deployed URL will be:
`https://nrogue19.github.io/Mission-Control`

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3100](http://localhost:3100) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm run start:backend`

Runs the local mock backend on [http://localhost:8797](http://localhost:8797).

### `npm run start:live`

Runs both the React frontend and the local mock backend together in one command.

Use this for local live-integration development so API and WebSocket endpoints are available.

### `npm run start:standalone`

Alias of `start:live` for the self-contained runtime mode.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
