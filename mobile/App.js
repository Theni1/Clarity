import { useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const BACKEND_URL = 'http://172.20.10.6:8000';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [detections, setDetections] = useState(null);
  const [status, setStatus] = useState('');
  const cameraRef = useRef(null);

  // Permission not loaded yet
  if (!permission) {
    return <View style={styles.container} />;
  }

  // Permission not granted yet
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Clarity needs camera access</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function capture() {
    const photo = await cameraRef.current.takePictureAsync();
    setPhotoUri(photo.uri);
    setDetections(null);
    setStatus('Reading text...');

    try {
      const form = new FormData();
      form.append('image', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      const res = await fetch(`${BACKEND_URL}/read-text`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      setDetections(data.detections);
      setStatus(`Found ${data.detections.length} text region(s)`);
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  }

  function reset() {
    setPhotoUri(null);
    setDetections(null);
    setStatus('');
  }

  // After capture: show photo + the OCR results (text for now [testing purposes])
  if (photoUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photoUri }} style={styles.preview} />
        <ScrollView style={styles.results}>
          <Text style={styles.status}>{status}</Text>
          {detections &&
            detections.map((d, i) => (
              <Text key={i} style={styles.detection}>
                {d.text}  ({Math.round(d.confidence * 100)}%)
              </Text>
            ))}
        </ScrollView>
        <TouchableOpacity style={styles.button} onPress={reset}>
          <Text style={styles.buttonText}>Retake</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Live camera + capture button
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} />
      <TouchableOpacity style={styles.captureButton} onPress={capture}>
        <Text style={styles.buttonText}>Capture</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  preview: {
    flex: 2,
    resizeMode: 'contain',
  },
  results: {
    flex: 1,
    backgroundColor: '#111',
    paddingHorizontal: 20,
  },
  status: {
    color: '#1e90ff',
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 10,
  },
  detection: {
    color: '#fff',
    fontSize: 18,
    paddingVertical: 4,
  },
  message: {
    color: '#fff',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  captureButton: {
    backgroundColor: '#1e90ff',
    paddingVertical: 24,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#1e90ff',
    paddingVertical: 20,
    marginHorizontal: 40,
    marginBottom: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
});
