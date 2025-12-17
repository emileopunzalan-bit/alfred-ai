import React, { useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:5050';
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBase64(bytes: Uint8Array) {
  let result = '';
  let i = 0;
  const len = bytes.length;

  for (; i + 2 < len; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += base64Chars[(chunk >> 18) & 0x3f];
    result += base64Chars[(chunk >> 12) & 0x3f];
    result += base64Chars[(chunk >> 6) & 0x3f];
    result += base64Chars[chunk & 0x3f];
  }

  const remaining = len - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    result += base64Chars[(chunk >> 18) & 0x3f];
    result += base64Chars[(chunk >> 12) & 0x3f];
    result += '==';
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result += base64Chars[(chunk >> 18) & 0x3f];
    result += base64Chars[(chunk >> 12) & 0x3f];
    result += base64Chars[(chunk >> 6) & 0x3f];
    result += '=';
  }

  return result;
}

type ChatHistory = { role: 'user' | 'assistant'; content: string };

export default function HomeScreen() {
  const [status, setStatus] = useState('Ready');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [typed, setTyped] = useState('');
  const [history, setHistory] = useState<ChatHistory[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const canUseLocalhost = useMemo(() => Platform.OS === 'web', []);

  async function ensureAudioPermissions() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission denied.');
  }

  async function startRecording() {
    try {
      setStatus('Requesting mic permission...');
      await ensureAudioPermissions();

      setStatus('Preparing recording...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setStatus('Recording… Tap again to stop.');
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function stopRecordingAndSend() {
    try {
      setStatus('Stopping recording...');
      setIsRecording(false);

      const recording = recordingRef.current;
      if (!recording) throw new Error('No active recording.');

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('Recording URI missing.');

      setStatus('Uploading audio to STT...');
      const text = await callSTT(uri);
      setTranscript(text);

      setStatus('Asking Alfred...');
      const assistantReply = await callChat(text);
      setReply(assistantReply);

      setStatus('Generating voice...');
      const audioUri = await callTTS(assistantReply);

      setStatus('Playing...');
      await playAudio(audioUri);

      setStatus('Done ✅');
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function callSTT(audioUri: string) {
    const url = `${BACKEND_URL}/stt`;

    const form = new FormData();
    form.append('audio', {
      uri: audioUri,
      name: 'audio.m4a',
      type: 'audio/m4a',
    } as any);

    const res = await fetch(url, {
      method: 'POST',
      body: form,
      headers: {
        // Let fetch set multipart boundary automatically
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'STT failed');
    return (data.text || '').trim();
  }

  async function callChat(message: string) {
    const url = `${BACKEND_URL}/chat`;

    const newHistory = [...history, { role: 'user', content: message }];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: newHistory }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Chat failed');

    const assistantReply = (data.reply || '').trim();
    console.log('[Alfred] assistant reply:', assistantReply);
    setHistory([...newHistory, { role: 'assistant', content: assistantReply }]);
    return assistantReply;
  }

  async function callTTS(text: string) {
    const url = `${BACKEND_URL}/tts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'TTS failed');
    }

    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        data.note || 'TTS returned JSON (likely MOCK_MODE=true). Set MOCK_MODE=false to get audio.'
      );
    }

    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const FileSystem = await import('expo-file-system');
    const path = `${FileSystem.cacheDirectory}alfred_tts_${Date.now()}.mp3`;

    const base64 = encodeBase64(bytes);

    console.log('[Alfred] TTS audio cache path:', path);

    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
    return path;
  }

  async function playAudio(uri: string) {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }

    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    soundRef.current = sound;
    await sound.playAsync();
  }

  async function handleTypedSend() {
    try {
      if (!typed.trim()) return;
      setStatus('Asking Alfred...');
      const assistantReply = await callChat(typed.trim());
      setReply(assistantReply);

      setStatus('Generating voice...');
      const audioUri = await callTTS(assistantReply);

      setStatus('Playing...');
      await playAudio(audioUri);

      setStatus('Done ✅');
      setTyped('');
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <View style={{ padding: 16, gap: 12, flex: 1 }}>
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>Alfred</Text>
        <Text style={{ color: '#B8B8C7' }}>Backend: {BACKEND_URL}</Text>

        <Pressable
          onPress={isRecording ? stopRecordingAndSend : startRecording}
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: isRecording ? '#7A1F2B' : '#1E2A78',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
            {isRecording ? 'Stop & Send' : 'Tap to Talk'}
          </Text>
        </Pressable>

        <View style={{ gap: 8 }}>
          <Text style={{ color: '#B8B8C7' }}>Or type:</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="Type a message to Alfred..."
              placeholderTextColor="#6D6D7A"
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                backgroundColor: '#141420',
                color: 'white',
              }}
            />
            <Pressable
              onPress={handleTypedSend}
              style={{
                paddingHorizontal: 14,
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: '#2A2A3A',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Send</Text>
            </Pressable>
          </View>
        </View>

        <Text style={{ color: '#B8B8C7' }}>Status: {status}</Text>

        <ScrollView style={{ flex: 1, backgroundColor: '#11111A', borderRadius: 14, padding: 12 }}>
          <Text style={{ color: '#8EE3FF', fontWeight: '700' }}>Transcript</Text>
          <Text style={{ color: 'white', marginBottom: 12 }}>{transcript || '—'}</Text>

          <Text style={{ color: '#FFD27D', fontWeight: '700' }}>Alfred Reply</Text>
          <Text style={{ color: 'white' }}>{reply || '—'}</Text>
        </ScrollView>

        {!canUseLocalhost && BACKEND_URL.includes('localhost') ? (
          <Text style={{ color: '#FF8888' }}>
            ⚠️ On a physical phone, localhost won’t work. Set EXPO_PUBLIC_BACKEND_URL to your PC’s LAN IP.
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
