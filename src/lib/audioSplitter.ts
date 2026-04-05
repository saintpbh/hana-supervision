/**
 * 브라우저 내부에서 AudioContext를 이용해 오디오 파일을 읽고,
 * 16kHz Mono WAV 형태로 다운샘플링 및 특정 분 단위(chunkMinutes)로 청크 분할합니다.
 */

function bufferToWave(abuffer: AudioBuffer, len: number): Blob {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i, sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded in this exporter)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // write 16-bit sample
      pos += 2;
    }
    offset++                                     // next source sample
  }

  return new Blob([buffer], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

export async function splitAudioIntoWavChunks(file: File, chunkMinutes: number, onProgress?: (msg: string) => void): Promise<File[]> {
  onProgress?.(`오디오 해석 중... (파일 용량에 따라 브라우저가 일시정지될 수 있습니다)`);
  
  const arrayBuffer = await file.arrayBuffer();
  // Decode Full Audio
  const tempCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
  await tempCtx.close();

  const targetSampleRate = 16000; // 16kHz for excellent voice balance / size
  const durationSeconds = decodedBuffer.duration;
  const chunkDurationSecs = chunkMinutes * 60;
  
  if (durationSeconds <= chunkDurationSecs) {
    onProgress?.(`오디오 길이가 20분 이내이므로 분할 없이 직접 변환합니다.`);
    // Still needs to convert to 1 chunk if we want uniformity? 
    // Actually if it's small, we return the original file to avoid wasting time!
    return [file];
  }

  const numChunks = Math.ceil(durationSeconds / chunkDurationSecs);
  const chunks: File[] = [];

  for (let i = 0; i < numChunks; i++) {
    onProgress?.(`오디오 분할 병합 중... (${i + 1}/${numChunks} 구간)`);
    
    const startSec = i * chunkDurationSecs;
    const endSec = Math.min((i + 1) * chunkDurationSecs, durationSeconds);
    const chunkLengthSec = endSec - startSec;
    
    // Create Offline Context
    const offlineCtx = new (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext)(
      1, // Mono
      targetSampleRate * chunkLengthSec,
      targetSampleRate
    );
    
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    
    // Start at offset
    source.start(0, startSec, chunkLengthSec);
    
    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
    
    // Convert Blob to File
    const chunkFile = new File([wavBlob], `${file.name.split('.')[0]}_part${i+1}.wav`, { type: "audio/wav" });
    chunks.push(chunkFile);
  }

  onProgress?.(`총 ${numChunks}개의 파일로 분할 완료되었습니다.`);
  return chunks;
}
