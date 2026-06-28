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
  const [mode, setMode] = useState('text'); // 'text' or 'detect'
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
    setStatus(mode === 'text' ? 'Reading text...' : 'Detecting objects...');

    try {
      const form = new FormData();
      form.append('image', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      const endpoint = mode === 'text' ? '/read-text' : '/detect';
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      setDetections(data.detections);
      const noun = mode === 'text' ? 'text region' : 'object';
      setStatus(`Found ${data.detections.length} ${noun}(s)`);
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
    // Text boxes are 4 corners [[x,y],...]; detect boxes are flat [x1,y1,x2,y2].
    const xs = Array.isArray(box[0]) ? box.map((p) => p[0]) : [box[0], box[2]];
    const ys = Array.isArray(box[0]) ? box.map((p) => p[1]) : [box[1], box[3]];
    const left = Math.min(...xs) * scaleX;
    const top = Math.min(...ys) * scaleY;
    const width = (Math.max(...xs) - Math.min(...xs)) * scaleX;
    const height = (Math.max(...ys) - Math.min(...ys)) * scaleY;
    return { left, top, width, height };
  }

  // Text mode = tappable list + detect mode = labels on boxes.
  if (photoUri) {
    const aspect = photoSize ? photoSize.width / photoSize.height : 1;
    const items = detections || [];
    const clean = mode === 'text' ? cleanDetections(items) : items;

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
              clean.map((d, i) => {
                if (mode === 'text' && selected !== null && selected !== i) return null;
                return (
                  <View key={i} style={[styles.box, boxStyle(d.box)]}>
                    {mode === 'detect' && <Text style={styles.boxLabel}>{d.label}</Text>}
                  </View>
                );
              })}
          </View>
        </View>

        <ScrollView style={styles.results}>
          <Text style={styles.status}>{status}</Text>
          {mode === 'text'
            ? clean.map((d, i) => (
                <TouchableOpacity key={i} onPress={() => selectRow(i, d.text)}>
                  <Text style={[styles.detection, selected === i && styles.detectionSelected]}>
                    {d.text}
                  </Text>
                </TouchableOpacity>
              ))
            : clean.map((d, i) => (
                <Text key={i} style={styles.detection}>
                  {d.label} ({Math.round(d.confidence * 100)}%)
                </Text>
              ))}
        </ScrollView>

        <TouchableOpacity style={styles.button} onPress={reset}>
          <Text style={styles.buttonText}>Retake</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Live camera + mode toggle + capture button
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} />

      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleOption, mode === 'text' && styles.toggleActive]}
          onPress={() => setMode('text')}
        >
          <Text
            style={[styles.toggleText, mode === 'text' && styles.toggleTextActive]}
            numberOfLines={1}
          >
            Read Text
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleOption, mode === 'detect' && styles.toggleActive]}
          onPress={() => setMode('detect')}
        >
          <Text
            style={[styles.toggleText, mode === 'detect' && styles.toggleTextActive]}
            numberOfLines={1}
          >
            Detect Objects
          </Text>
        </TouchableOpacity>
      </View>

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
  boxLabel: {
    position: 'absolute',
    top: -20,
    left: -2,
    backgroundColor: '#1e90ff',
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
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
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#111',
    height: 56,
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  toggleActive: {
    backgroundColor: '#1e90ff',
  },
  toggleText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
    fontWeight: '700',
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
