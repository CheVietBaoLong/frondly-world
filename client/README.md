# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## ⚠️ Running on Android (development build required)

This app **cannot run in Expo Go**. It depends on native modules that are not
bundled in Expo Go (WatermelonDB JSI, `expo-glass-effect`, `expo-dev-client`),
so you must use a **development build**.

### Prerequisites

- Node + Yarn (this repo commits `yarn.lock` — use Yarn, not npm, so installs match)
- **JDK 17** — React Native 0.85's Gradle/AGP does **not** build on JDK 21/25.
  Point `JAVA_HOME` at a JDK 17 install (e.g. Temurin 17).
- Android SDK (Android Studio) and a device or emulator.

### Build & install the dev client

```bash
# JAVA_HOME must be JDK 17
npx expo run:android
```

This compiles the dev client, installs it on the connected device/emulator, and
starts Metro. (Alternatively, build in the cloud: `eas build --profile development --platform android`.)

### Run it again later (no rebuild needed)

```bash
# (wireless device) pair/connect over Wi-Fi, then tunnel Metro to the phone
adb connect <PHONE_IP>:<PORT>
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client
```

Open the installed **dev-client** app and connect to `http://localhost:8081`.

> Tip: if relaunching via a deep link lands on the launcher instead of your app,
> force-stop first so it loads fresh:
>
> ```bash
> adb shell am force-stop com.frondly.app
> adb shell am start -a android.intent.action.VIEW \
>   -d 'exp+frondly://expo-development-client/?url=http://localhost:8081'
> ```

## Get started

1. Install dependencies

   ```bash
   yarn install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- ~~[Expo Go](https://expo.dev/go)~~ — **not supported** for this project (see the Android section above); use a development build.

> `npm run ios` builds and installs a native dev client via `expo run:ios`
> (Xcode + CocoaPods required) rather than launching Expo Go — same reason as
> Android above, this app depends on native modules Expo Go doesn't bundle.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
