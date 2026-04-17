import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = '@brycelearning_parent_pin';

export async function getParentPin() {
  return await AsyncStorage.getItem(PIN_KEY);
}

export async function setParentPin(pin) {
  await AsyncStorage.setItem(PIN_KEY, pin);
}

export async function clearParentPin() {
  await AsyncStorage.removeItem(PIN_KEY);
}
