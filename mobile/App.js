import { useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';

const BACKEND_URL = 'http://172.20.10.6:8000';
const MIN_CONFIDENCE = 0.3;

// Filter out low-confidence scores + sort into reading order
function cleanDetections(detections) {
  return detections
    .filter((d) => d.confidence >= MIN_CONFIDENCE)
    .map((d) => ({
      ...d,
      _top: Math.min(...d.box.map((p) => p[1])),
      _left: Math.min(...d.box.map((p) => p[0])),
    }))
    .sort((a, b) => (Math.abs(a._top - b._top) > 20 ? a._top - b._top : a._left - b._left));
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [photoSize, setPhotoSize] = useState(null); // actual image pixels {width, height}
  const [layout, setLayout] = useState(null); // on-screen size of the image {width, height}
  const [detections, setDetections] = useState(null);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null); // index of tapped text row, or null
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
    setPhotoSize({ width: photo.width, height: photo.height });
    setLayout(null);
    setDetections(null);
    setSelected(null);
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

  // Tap a row: toggle its selection (isolates its box) and speak that line.
  function selectRow(i, text) {
    if (selected === i) {
      setSelected(null);
      Speech.stop();
    } else {
      setSelected(i);
      Speech.speak(text, { rate: 0.85 });
    }
  }

  function reset() {
    setPhotoUri(null);
    setPhotoSize(null);
    setLayout(null);
    setDetections(null);
    setSelected(null);
    setStatus('');
  }


  function boxStyle(box) {
    const scaleX = layout.width / photoSize.width;
    const scaleY = layout.height / photoSize.height;
    const xs = box.map((p) => p[0]);
    const ys = box.map((p) => p[1]);
    const left = Math.min(...xs) * scaleX;
    const top = Math.min(...ys) * scaleY;
    const width = (Math.max(...xs) - Math.min(...xs)) * scaleX;
    const height = (Math.max(...ys) - Math.min(...ys)) * scaleY;
    return { left, top, width, height };
  }

  // After capture: show photo with numbered boxes + enlarged text + read-aloud
  if (photoUri) {
    const aspect = photoSize ? photoSize.width / photoSize.height : 1;
    const clean = detections ? cleanDetections(detections) : [];

    return (
      <View style={styles.container}>
        <View style={styles.imageArea}>
          <View
            style={[styles.imageWrap, { aspectRatio: aspect }]}
            onLayout={(e) => setLayout(e.nativeEvent.layout)}
          >
            <Image source={{ uri: photoUri }} style={styles.image} />
            {layout &&
              photoSize &&
              clean.map((d, i) =>
                // Show all boxes by default; once a row is tapped, show only that one.
                selected === null || selected === i ? (
                  <View key={i} style={[styles.box, boxStyle(d.box)]} />
                ) : null
              )}
          </View>
        </View>

        <ScrollView style={styles.results}>
          <Text style={styles.status}>{status}</Text>
          {clean.map((d, i) => (
            <TouchableOpacity key={i} onPress={() => selectRow(i, d.text)}>
              <Text style={[styles.detection, selected === i && styles.detectionSelected]}>
                {d.text}
              </Text>
            </TouchableOpacity>
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
  imageArea: {
    flex: 2,
    justifyContent: 'center',
  },
  imageWrap: {
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#1e90ff',
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
    fontSize: 24,
    fontWeight: '500',
    paddingVertical: 6,
  },
  detectionSelected: {
    color: '#1e90ff',
    fontWeight: '700',
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
