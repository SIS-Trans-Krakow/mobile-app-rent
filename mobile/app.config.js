// Dynamic Expo config — extends app.json.
// Sets experiments.baseUrl from EXPO_BASE_URL env var so the same codebase can be
// built for different sub-path deployments without editing app.json.
//
//   EXPO_BASE_URL=/odbiory npx expo export --platform web
//
// Leave EXPO_BASE_URL unset (or "/") to serve from the web server root.

module.exports = ({ config }) => {
    const raw = process.env.EXPO_BASE_URL;
    const baseUrl =
        raw && raw !== '/' ? (raw.startsWith('/') ? raw : `/${raw}`) : undefined;

    return {
        ...config,
        experiments: {
            ...(config.experiments || {}),
            ...(baseUrl ? { baseUrl } : {}),
        },
    };
};
