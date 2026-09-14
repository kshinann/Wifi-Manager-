import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DevicesProvider } from './src/context/DevicesContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { AddDeviceScreen } from './src/screens/AddDeviceScreen';
import { DeviceControlScreen } from './src/screens/DeviceControlScreen';
import { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <DevicesProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="AddDevice"
              component={AddDeviceScreen}
              options={{ title: 'Add Device', presentation: 'modal' }}
            />
            <Stack.Screen name="DeviceControl" component={DeviceControlScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </DevicesProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
