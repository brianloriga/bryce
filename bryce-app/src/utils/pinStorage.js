import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'snapstudy_parent_pin';

export async function getParentPin() {
  return await SecureStore.getItemAsync(PIN_KEY);
}

export async function setParentPin(pin) {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function clearParentPin() {
  await SecureStore.deleteItemAsync(PIN_KEY);
}
