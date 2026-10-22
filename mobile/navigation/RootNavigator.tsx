import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NATIVE_UI_ENABLED } from './appShell';
import { navigationRef, type RootStackParamList } from './navigationRef';
import NativeRootNavigator from './NativeRootNavigator';
import StandaloneWebViewScreen from '../screens/StandaloneWebViewScreen';
import LoginScreen from '../screens/LoginScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator({ onReady }: { readonly onReady?: () => void } = {}) {
  if (NATIVE_UI_ENABLED) return <NativeRootNavigator onReady={onReady} />;

  return (
    <NavigationContainer ref={navigationRef} onReady={onReady}>
      <Stack.Navigator initialRouteName="WebView" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="WebView" component={StandaloneWebViewScreen} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
