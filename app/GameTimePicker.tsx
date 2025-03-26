import React from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type GameTimePickerProps = {
  gameTime: Date;
  onChangeGameTime: (event: any, selectedDate?: Date) => void;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
};

const getFormattedTime = (date: Date): string => {
    return date instanceof Date && !isNaN(date.getTime()) ? date.toISOString().slice(0, 16) : '';
  };

export default function GameTimePicker({
  gameTime,
  onChangeGameTime,
  showDatePicker,
  setShowDatePicker,
}: GameTimePickerProps) {
  return (
    <View>
      {Platform.OS === 'web' ? (
        // Use a native HTML input for web
        <input
          style={styles.input}
          type="datetime-local"
          value={getFormattedTime(gameTime)}
          onChange={(e) => {
            const selectedDate = new Date(e.target.value);
            onChangeGameTime(null, selectedDate);
          }}
        />
      ) : (
        <>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={styles.input}
          >
            <Text>{gameTime.toLocaleString()}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={gameTime}
              mode="datetime"
              display="default"
              onChange={onChangeGameTime}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
});