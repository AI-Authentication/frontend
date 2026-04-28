import { useEffect, useRef, useState } from 'react'
import {
  API_BASE_URL,
  adminLogin,
  createProfile,
  deleteProfile,
  listProfiles,
  recognizeFace,
  runFgsmAttack,
} from './api'
import { Analytics } from '@vercel/analytics/react'

const tabs = [
  { id: 'register', label: 'Register Face' },
  { id: 'recognize', label: 'Recognition Test' },
  { id: 'attack', label: 'FGSM Attack Demo' },
  { id: 'admin', label: 'Admin' },
]

const capturePrompts = [
  { id: 'front', label: 'Straight on' },
  { id: 'left', label: 'Look left' },
  { id: 'right', label: 'Look right' },
  { id: 'brows', label: 'Eyebrows up' },
  { id: 'down', label: 'Head down' },
]

const seedProfiles = [
  {
    id: 1,
    name: 'Avery Chen',
    image:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
    photos: [],
  },
  {
    id: 2,
    name: 'Jordan Rivera',
    image:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
    photos: [],
  },
]

function getProfileById(profiles, profileId) {
  return profiles.find((profile) => String(profile.id) === String(profileId))
}

function formatConfidence(confidence) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return ''
  const value = confidence <= 1 ? confidence * 100 : confidence
  return `${value.toFixed(1)}%`
}

function readSingleImageFile(event, setter) {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => setter(String(reader.result))
  reader.readAsDataURL(file)
}

function App() {
  const [activeTab, setActiveTab] = useState('register')
  const [profiles, setProfiles] = useState(seedProfiles)
  const [captureName, setCaptureName] = useState('')
  const [capturedImage, setCapturedImage] = useState('')
  const [capturedShots, setCapturedShots] = useState({})
  const [captureStep, setCaptureStep] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraState, setCameraState] = useState('idle')
  const [cameraError, setCameraError] = useState('')
  const [cameraView, setCameraView] = useState(null)
  const [registerMessage, setRegisterMessage] = useState(
    'Capture five guided face photos, then save the profile through the API.',
  )
  const [recognitionMode, setRecognitionMode] = useState('upload')
  const [recognitionImage, setRecognitionImage] = useState('')
  const [recognizedProfileId, setRecognizedProfileId] = useState(String(seedProfiles[0].id))
  const [recognitionResult, setRecognitionResult] = useState('')
  const [attackImage, setAttackImage] = useState('')
  const [attackTargetId, setAttackTargetId] = useState(String(seedProfiles[1].id))
  const [attackStrength, setAttackStrength] = useState(12)
  const [attackResult, setAttackResult] = useState(
    'Use a captured face image to simulate the adversarial example.',
  )
  const [attackNoiseImage, setAttackNoiseImage] = useState('')
  const [attackOutputImage, setAttackOutputImage] = useState('')
  const [apiStatus, setApiStatus] = useState('Loading profiles from the backend.')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [isRunningAttack, setIsRunningAttack] = useState(false)
  const [isDeletingProfile, setIsDeletingProfile] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminCredentials, setAdminCredentials] = useState(null)
  const [adminMessage, setAdminMessage] = useState('Use the admin login to manage enrolled users.')
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const registerVideoRef = useRef(null)
  const recognitionVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (registerVideoRef.current) {
      registerVideoRef.current.srcObject = null
    }

    if (recognitionVideoRef.current) {
      recognitionVideoRef.current.srcObject = null
    }

    setCameraReady(false)
    setCameraState('idle')
    setCameraView(null)
    setCameraError('')
  }

  useEffect(() => {
    let cancelled = false

    async function loadProfiles() {
      try {
        const remoteProfiles = await listProfiles()

        if (cancelled || remoteProfiles.length === 0) return

        setProfiles(remoteProfiles)
        setRecognizedProfileId(String(remoteProfiles[0].id))
        setAttackTargetId(String(remoteProfiles[0].id))
        setApiStatus(`Connected to ${API_BASE_URL || 'the current origin'} and loaded profiles.`)
      } catch (error) {
        if (cancelled) return
        setApiStatus(
          `Backend not reachable yet. Using local demo profiles. ${error.message || 'API request failed.'}`,
        )
      }
    }

    loadProfiles()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [])

  useEffect(() => {
    if (profiles.length === 0) return

    if (!getProfileById(profiles, recognizedProfileId)) {
      setRecognizedProfileId(String(profiles[0].id))
    }

    if (!getProfileById(profiles, attackTargetId)) {
      setAttackTargetId(String(profiles[0].id))
    }
  }, [profiles, recognizedProfileId, attackTargetId])

  useEffect(() => {
    stopCamera()
    if (activeTab !== 'recognize') {
      setRecognitionMode('upload')
    }
  }, [activeTab])

  async function startCamera(view) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraError('`navigator.mediaDevices.getUserMedia` is unavailable in this browser.')
      if (view === 'register') {
        setRegisterMessage('This browser does not support direct camera capture.')
      } else {
        setRecognitionResult('This browser does not support direct camera capture.')
      }
      return
    }

    if (!window.isSecureContext) {
      setCameraState('error')
      setCameraError(
        'Camera access requires a secure origin. Use `http://localhost` or `https://` instead of a raw local IP or file URL.',
      )
      if (view === 'register') {
        setRegisterMessage('Camera access is blocked because this page is not running in a secure context.')
      } else {
        setRecognitionResult('Camera access is blocked because this page is not running in a secure context.')
      }
      return
    }

    try {
      stopCamera()
      setCameraState('loading')

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream
      setCameraView(view)

      const targetVideo = view === 'register' ? registerVideoRef.current : recognitionVideoRef.current
      if (targetVideo) {
        targetVideo.srcObject = stream
        await targetVideo.play().catch(() => {})
      }

      setCameraReady(true)
      setCameraState('ready')
      if (view === 'register') {
        setRegisterMessage('Camera is live. Capture all five guided poses to finish registration.')
      } else {
        setRecognitionResult('Camera is live. Capture a test face when you are ready.')
      }
    } catch (error) {
      setCameraReady(false)
      setCameraState('error')
      setCameraError(`${error?.name || 'UnknownError'}: ${error?.message || 'Camera request failed.'}`)
      const errorMessage =
        error?.name === 'NotAllowedError'
          ? 'Camera permission was blocked. Check the browser site settings and retry.'
          : error?.name === 'NotFoundError'
            ? 'No camera device was found on this machine.'
            : error?.name === 'NotReadableError'
              ? 'The camera is already in use by another application.'
              : 'Camera could not be started. Retry and confirm browser camera access.'

      if (view === 'register') {
        setRegisterMessage(errorMessage)
      } else {
        setRecognitionResult(errorMessage)
      }
    }
  }

  function captureRegisterFromCamera() {
    const video = registerVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraReady || cameraView !== 'register') {
      setRegisterMessage('Start the camera first, then capture a photo.')
      return
    }

    canvas.width = video.videoWidth || 960
    canvas.height = video.videoHeight || 720
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const nextImage = canvas.toDataURL('image/jpeg', 0.92)
    const prompt = capturePrompts[captureStep]
    const nextShots = {
      ...capturedShots,
      [prompt.id]: nextImage,
    }

    setCapturedShots(nextShots)
    setCapturedImage(nextShots.front || nextImage)

    if (captureStep < capturePrompts.length - 1) {
      setCaptureStep(captureStep + 1)
      setRegisterMessage(`Captured ${prompt.label}. Next: ${capturePrompts[captureStep + 1].label}.`)
      return
    }

    setRegisterMessage('All five photos captured. Add a name and save the user.')
  }

  function captureRecognitionFromCamera() {
    const video = recognitionVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraReady || cameraView !== 'recognize') {
      setRecognitionResult('Start the camera first, then capture a test face.')
      return
    }

    canvas.width = video.videoWidth || 960
    canvas.height = video.videoHeight || 720
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const nextImage = canvas.toDataURL('image/jpeg', 0.92)
    setRecognitionImage(nextImage)
    setRecognitionResult('Captured a test face from the live camera preview.')
  }

  async function registerProfile() {
    if (!captureName.trim() || Object.keys(capturedShots).length < capturePrompts.length) {
      setRegisterMessage('A name and all five face images are required for registration.')
      return
    }

    setIsRegistering(true)
    setRegisterMessage('Saving profile to the backend.')

    try {
      const profile = await createProfile({
        name: captureName.trim(),
        captures: capturePrompts.reduce((result, prompt) => {
          result[prompt.id] = capturedShots[prompt.id]
          return result
        }, {}),
      })

      setProfiles((current) => [profile, ...current.filter((item) => String(item.id) !== String(profile.id))])
      setRecognizedProfileId(String(profile.id))
      setAttackTargetId(String(profile.id))
      setCaptureName('')
      setCapturedImage('')
      setCapturedShots({})
      setCaptureStep(0)
      setRegisterMessage(`Profile saved for ${profile.name}.`)
      setApiStatus(`Connected to ${API_BASE_URL || 'the current origin'} and accepting writes.`)
    } catch (error) {
      setRegisterMessage(`Profile save failed. ${error.message || 'Backend request failed.'}`)
    } finally {
      setIsRegistering(false)
    }
  }

  async function runRecognitionDemo() {
    if (!recognitionImage) {
      setRecognitionResult('Capture or upload a face image to test recognition.')
      return
    }

    setIsRecognizing(true)
    setRecognitionResult('Running recognition request.')

    try {
      const result = await recognizeFace({
        image: recognitionImage,
        selectedProfileId: recognizedProfileId,
      })
      const confidenceText = formatConfidence(result?.confidence)
      const matchedProfile =
        result?.match || getProfileById(profiles, result?.profileId || result?.matchedProfileId)
      const matchedName =
        matchedProfile?.name || result?.name || result?.matchedName || 'Unknown user'
      const details = [confidenceText && `Confidence score: ${confidenceText}`, result?.message]
        .filter(Boolean)
        .join(' ')

      setRecognitionResult(`Welcome ${matchedName}.${details ? ` ${details}` : ''}`)
    } catch (error) {
      setRecognitionResult(`Recognition request failed. ${error.message || 'Backend request failed.'}`)
    } finally {
      setIsRecognizing(false)
    }
  }

  async function runAttackDemo() {
    if (!attackImage) {
      setAttackResult('Select a captured test face first from the recognition step.')
      return
    }

    setIsRunningAttack(true)
    setAttackResult('Running FGSM request.')

    try {
      const result = await runFgsmAttack({
        image: attackImage,
        targetProfileId: attackTargetId,
        epsilon: attackStrength,
      })

      const target =
        result?.target || getProfileById(profiles, result?.targetProfileId || attackTargetId)
      const targetName = target?.name || result?.targetName || 'the requested target'
      const summary =
        result?.message ||
        `FGSM perturbation applied at epsilon ${result?.epsilon || attackStrength}. Model prediction shifted to ${targetName}.`

      setAttackNoiseImage(result?.perturbationImage || result?.noiseImage || '')
      setAttackOutputImage(result?.adversarialImage || attackImage)
      setAttackResult(summary)
    } catch (error) {
      setAttackNoiseImage('')
      setAttackOutputImage('')
      setAttackResult(`FGSM request failed. ${error.message || 'Backend request failed.'}`)
    } finally {
      setIsRunningAttack(false)
    }
  }

  function handleRecognitionUpload(event) {
    readSingleImageFile(event, (image) => {
      setRecognitionMode('upload')
      setRecognitionImage(image)
      setRecognitionResult('Test face loaded from file.')
    })
  }

  function useRecognitionCaptureForAttack() {
    if (!recognitionImage) {
      setAttackResult('Capture or upload a recognition test image first.')
      return
    }

    setAttackImage(recognitionImage)
    setAttackOutputImage('')
    setAttackNoiseImage('')
    setAttackResult('Using the current recognition test face as the FGSM input image.')
  }

  async function handleAdminLogin(event) {
    event.preventDefault()

    try {
      await adminLogin({
        username: adminUsername,
        password: adminPassword,
      })

      setAdminCredentials({
        username: adminUsername,
        password: adminPassword,
      })
      setIsAdminAuthenticated(true)
      setAdminMessage('Admin authenticated through server-side environment variables.')
    } catch (error) {
      setAdminCredentials(null)
      setIsAdminAuthenticated(false)
      setAdminMessage(error.message || 'Invalid admin credentials.')
    }
  }

  async function handleDeleteProfile(profileId) {
    setIsDeletingProfile(true)
    setAdminMessage('Removing profile from the database.')

    try {
      await deleteProfile(profileId, adminCredentials)
      setProfiles((current) => current.filter((profile) => String(profile.id) !== String(profileId)))
      setAdminMessage('Profile removed successfully.')
    } catch (error) {
      setAdminMessage(`Delete failed. ${error.message || 'Backend request failed.'}`)
    } finally {
      setIsDeletingProfile(false)
    }
  }

  const targetProfile = getProfileById(profiles, attackTargetId)
  const noiseOpacity = Math.min(0.18 + attackStrength / 64, 0.6)
  const currentPrompt = capturePrompts[captureStep]
  const completedShots = Object.keys(capturedShots).length
  const registrationReady = completedShots === capturePrompts.length
  const recognitionCameraVisible = recognitionMode === 'camera'
  const noiseStyle = attackNoiseImage
    ? { backgroundImage: `url(${attackNoiseImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {
        backgroundColor: '#091727',
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(47,127,249,${noiseOpacity}) 0 1px, transparent 1px 6px),
          repeating-linear-gradient(90deg, rgba(255,255,255,${noiseOpacity / 2}) 0 1px, transparent 1px 7px)
        `,
      }

  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-block">
            <p className="hero-label">Face Authentication Capstone</p>
            <h1>Registration, recognition, attack testing, and admin control</h1>
          </div>

          <nav className="tab-bar" aria-label="Sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tab.id === activeTab ? 'tab active' : 'tab'}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <section className="hero">
          <p className="hero-text">
            The frontend now targets Vercel serverless API routes that can persist profiles into a
            Neon Postgres database at deploy time. Until a database is configured, the UI falls back
            to local demo profiles for presentation.
          </p>
          <p className="hero-text">{apiStatus}</p>
        </section>

        <main className="panel">
          {activeTab === 'register' && (
            <section className="content-grid content-section">
              <div className="section-card">
                <div className="section-heading">
                  <p className="section-kicker">Registration</p>
                  <h2>Register a user face</h2>
                </div>

                <p className="section-copy">
                  Capture five guided images for each user: straight on, look left, look right,
                  eyebrows up, and head down. The backend receives all five images as base64 data
                  and persists the enrolled profile to Neon.
                </p>

                <div className="camera-frame">
                  <video
                    ref={registerVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={cameraReady && cameraView === 'register' ? 'camera-video' : 'camera-video hidden'}
                  />
                  {(!cameraReady || cameraView !== 'register') && (
                    <div className="camera-fallback">
                      {cameraState === 'loading'
                        ? 'Starting camera...'
                        : 'Camera is off. Start it here and capture the five required registration poses.'}
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <div className="capture-guide">
                  <div className="capture-step">
                    <span className="guide-count">
                      {Math.min(completedShots + (completedShots === capturePrompts.length ? 0 : 1), 5)} / 5
                    </span>
                    <strong>{currentPrompt?.label || 'Complete'}</strong>
                  </div>
                  <div className="guide-list">
                    {capturePrompts.map((prompt, index) => (
                      <div
                        key={prompt.id}
                        className={
                          capturedShots[prompt.id]
                            ? 'guide-item done'
                            : index === captureStep
                              ? 'guide-item active'
                              : 'guide-item'
                        }
                      >
                        {prompt.label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="actions single-row-actions">
                  <button
                    type="button"
                    className={
                      registrationReady
                        ? 'secondary-button compact-button complete'
                        : 'primary-button compact-button'
                    }
                    onClick={cameraState === 'ready' && cameraView === 'register' ? captureRegisterFromCamera : () => startCamera('register')}
                    disabled={registrationReady || isRegistering}
                  >
                    {cameraState === 'ready' && cameraView === 'register' ? 'Capture Photo' : 'Start Camera'}
                  </button>
                </div>

                <label className="field">
                  <span>Profile name</span>
                  <input
                    type="text"
                    value={captureName}
                    onChange={(event) => setCaptureName(event.target.value)}
                    placeholder="Enter a user name"
                  />
                </label>

                <button
                  type="button"
                  className={registrationReady ? 'primary-button wide' : 'primary-button wide disabled-button'}
                  onClick={registerProfile}
                  disabled={!registrationReady || isRegistering}
                >
                  {isRegistering ? 'Saving...' : 'Save To Database'}
                </button>

                <p className="status-text">{registerMessage}</p>
                <div className="camera-diagnostics">
                  <span>API base URL: {API_BASE_URL || 'same origin'}</span>
                  <span>Secure context: {window.isSecureContext ? 'yes' : 'no'}</span>
                  <span>Camera API: {navigator.mediaDevices?.getUserMedia ? 'available' : 'missing'}</span>
                  {cameraError && <span>Error: {cameraError}</span>}
                </div>
              </div>

              <div className="section-card preview-card">
                <div className="section-heading">
                  <p className="section-kicker">Stored Profiles</p>
                  <h2>Captured face and enrolled users</h2>
                </div>

                <div className="face-preview large">
                  {capturedImage ? (
                    <img src={capturedImage} alt="Captured profile preview" />
                  ) : (
                    <div className="empty-state">No face image captured yet.</div>
                  )}
                </div>

                <div className="database-list">
                  <div className="list-header">
                    <h3>Profile database</h3>
                    <span>{profiles.length} users</span>
                  </div>

                  {profiles.map((profile) => (
                    <div className="profile-row" key={profile.id}>
                      <img src={profile.image} alt={profile.name} />
                      <div>
                        <strong>{profile.name}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'recognize' && (
            <section className="content-grid content-section">
              <div className="section-card">
                <div className="section-heading">
                  <p className="section-kicker">Recognition</p>
                  <h2>Recognition test</h2>
                </div>

                <p className="section-copy">
                  Use an uploaded image or live camera capture and send it to the recognition
                  endpoint. The API returns the matched profile plus a confidence score.
                </p>

                <div className="inline-actions">
                  <label className="secondary-button">
                    Upload Test Face
                    <input type="file" accept="image/*" onChange={handleRecognitionUpload} />
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setRecognitionMode('camera')
                      startCamera('recognize')
                    }}
                  >
                    Take Photo
                  </button>
                  {recognitionCameraVisible && (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={captureRecognitionFromCamera}
                      disabled={cameraState !== 'ready' || cameraView !== 'recognize'}
                    >
                      Capture Test Face
                    </button>
                  )}
                </div>

                {recognitionCameraVisible && (
                  <div className="camera-frame inline-camera-frame">
                    <video
                      ref={recognitionVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={
                        cameraReady && cameraView === 'recognize' ? 'camera-video' : 'camera-video hidden'
                      }
                    />
                    {(!cameraReady || cameraView !== 'recognize') && (
                      <div className="camera-fallback">
                        {cameraState === 'loading'
                          ? 'Starting camera...'
                          : 'Camera preview appears here after camera access is granted.'}
                      </div>
                    )}
                  </div>
                )}

                <label className="field">
                  <span>Selected enrolled profile</span>
                  <select
                    value={recognizedProfileId}
                    onChange={(event) => setRecognizedProfileId(event.target.value)}
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={String(profile.id)}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="primary-button wide"
                  onClick={runRecognitionDemo}
                  disabled={isRecognizing}
                >
                  {isRecognizing ? 'Running...' : 'Run Recognition'}
                </button>

                <div className="result-banner success">
                  {recognitionResult || 'Recognition result will appear here.'}
                </div>
              </div>

              <div className="section-card preview-card">
                <div className="section-heading">
                  <p className="section-kicker">Inference Input</p>
                  <h2>Input sample</h2>
                </div>

                <div className="face-preview large">
                  {recognitionImage ? (
                    <img src={recognitionImage} alt="Recognition input preview" />
                  ) : recognitionCameraVisible ? (
                    <div className="empty-state">Live camera preview is active in the left panel.</div>
                  ) : (
                    <div className="empty-state">Capture or upload an image to preview the recognition test.</div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'attack' && (
            <section className="content-grid attack-layout content-section">
              <div className="section-card">
                <div className="section-heading">
                  <p className="section-kicker">Adversarial Attack</p>
                  <h2>FGSM attack showcase</h2>
                </div>

                <p className="section-copy">
                  The attack demo now reuses the most recent captured or uploaded recognition face
                  instead of accepting a separate upload. Send it to the FGSM endpoint with a target
                  profile and epsilon value.
                </p>

                <button type="button" className="secondary-button wide" onClick={useRecognitionCaptureForAttack}>
                  Use Recognition Test Face
                </button>

                <label className="field">
                  <span>Target impersonation profile</span>
                  <select value={attackTargetId} onChange={(event) => setAttackTargetId(event.target.value)}>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={String(profile.id)}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>FGSM epsilon strength</span>
                  <input
                    type="range"
                    min="1"
                    max="32"
                    value={attackStrength}
                    onChange={(event) => setAttackStrength(Number(event.target.value))}
                  />
                </label>

                <div className="metric-row">
                  <span>Low perturbation</span>
                  <strong>{attackStrength}</strong>
                  <span>High perturbation</span>
                </div>

                <button
                  type="button"
                  className="primary-button wide"
                  onClick={runAttackDemo}
                  disabled={isRunningAttack}
                >
                  {isRunningAttack ? 'Running...' : 'Run FGSM Attack'}
                </button>

                <div className="result-banner warning">{attackResult}</div>
              </div>

              <div className="section-card preview-card">
                <div className="section-heading">
                  <p className="section-kicker">Attack Mapping</p>
                  <h2>Source, perturbation, and target</h2>
                </div>

                <div className="attack-preview">
                  <div className="attack-stage">
                    <p className="attack-stage-label">Input face</p>
                    <div className="face-preview">
                      {attackImage ? (
                        <img src={attackImage} alt="Attack source preview" />
                      ) : (
                        <div className="empty-state">Recognition test face</div>
                      )}
                    </div>
                  </div>

                  <div className="attack-connector">
                    <span>FGSM</span>
                  </div>

                  <div className="attack-stage">
                    <p className="attack-stage-label">Raw perturbation</p>
                    <div className="face-preview noise-box" style={noiseStyle}>
                      <div className="noise-label">
                        <strong>{attackNoiseImage ? 'Backend output' : 'Raw noise'}</strong>
                        <span>Epsilon {attackStrength}</span>
                      </div>
                    </div>
                  </div>

                  <div className="attack-connector">
                    <span>Add</span>
                  </div>

                  <div className="attack-stage">
                    <p className="attack-stage-label">Predicted target</p>
                    <div className="face-preview">
                      {attackOutputImage ? (
                        <img src={attackOutputImage} alt="Adversarial output preview" />
                      ) : targetProfile ? (
                        <img src={targetProfile.image} alt={targetProfile.name} />
                      ) : (
                        <div className="empty-state">Target user</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'admin' && (
            <section className="content-grid content-section">
              <div className="section-card">
                <div className="section-heading">
                  <p className="section-kicker">Admin</p>
                  <h2>Manage enrolled users</h2>
                </div>

                <p className="section-copy">
                  This admin account is currently hard coded in the client for capstone use. Replace
                  it with a proper auth flow before using it outside a controlled demo environment.
                </p>

                {!isAdminAuthenticated ? (
                  <form className="admin-form" onSubmit={handleAdminLogin}>
                    <label className="field">
                      <span>Username</span>
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={(event) => setAdminUsername(event.target.value)}
                        placeholder="Configured in Vercel"
                      />
                    </label>

                    <label className="field">
                      <span>Password</span>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(event) => setAdminPassword(event.target.value)}
                        placeholder="Configured in Vercel"
                      />
                    </label>

                    <button type="submit" className="primary-button wide">
                      Log In
                    </button>
                  </form>
                ) : (
                  <div className="admin-actions">
                    <div className="admin-credentials">
                      <strong>Authenticated as hard-coded admin</strong>
                      <strong>Authenticated with server-side admin credentials</strong>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setIsAdminAuthenticated(false)
                          setAdminCredentials(null)
                          setAdminUsername('')
                          setAdminPassword('')
                          setAdminMessage('Admin logged out.')
                        }}
                      >
                        Log Out
                      </button>
                    </div>

                    <div className="database-list">
                      {profiles.map((profile) => (
                        <div className="profile-row admin-row" key={profile.id}>
                          <div className="profile-meta">
                            <img src={profile.image} alt={profile.name} />
                            <div>
                              <strong>{profile.name}</strong>
                              <span>ID {profile.id}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleDeleteProfile(profile.id)}
                            disabled={isDeletingProfile}
                          >
                            Remove User
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="result-banner warning">{adminMessage}</div>
              </div>

              <div className="section-card">
                <div className="section-heading">
                  <p className="section-kicker">Backend</p>
                  <h2>Vercel and Neon setup</h2>
                </div>

                <div className="integration-list">
                  <div className="integration-item">
                    <span>DB</span>
                    <p>
                      Set <code>DATABASE_URL</code> in Vercel using your Neon connection string. The
                      serverless functions auto-create the profiles table on first use.
                    </p>
                  </div>
                  <div className="integration-item">
                    <span>AUTH</span>
                    <p>
                      Set <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code> in Vercel to
                      control the admin login and delete actions.
                    </p>
                  </div>
                  <div className="integration-item">
                    <span>GET</span>
                    <p><code>/api/profiles</code> returns the enrolled users from Neon.</p>
                  </div>
                  <div className="integration-item">
                    <span>POST</span>
                    <p><code>/api/profiles</code> stores a new user with the captured face set.</p>
                  </div>
                  <div className="integration-item">
                    <span>DEL</span>
                    <p><code>/api/profiles/:id</code> removes a registered user for the admin page.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="about-grid footer-section">
            <div className="section-card">
              <div className="section-heading">
                <p className="section-kicker">Overview</p>
                <h2>What this site is demonstrating</h2>
              </div>

              <p className="section-copy">
                The capstone flow is split into registration, recognition, adversarial attack, and
                admin management so viewers can compare normal authentication against attack behavior
                and simple operational controls.
              </p>

              <div className="about-points">
                <div>
                  <strong>Normal path</strong>
                  <p>User face is enrolled and later recognized for authentication.</p>
                </div>
                <div>
                  <strong>Attack path</strong>
                  <p>
                    An adversarially perturbed image steers the classifier toward a different
                    enrolled identity.
                  </p>
                </div>
                <div>
                  <strong>Persistence</strong>
                  <p>
                    Vercel serverless routes can now persist profiles in Neon rather than relying on
                    in-memory demo data only.
                  </p>
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-heading">
                <p className="section-kicker">Integration</p>
                <h2>Required backend endpoints</h2>
              </div>

              <div className="integration-list">
                <div className="integration-item">
                  <span>GET</span>
                  <p><code>/api/profiles</code> returns the enrolled profile list used by the dropdowns and database panel.</p>
                </div>
                <div className="integration-item">
                  <span>POST</span>
                  <p><code>/api/profiles</code> accepts <code>{'{ name, captures }'}</code> and returns the saved profile record.</p>
                </div>
                <div className="integration-item">
                  <span>POST</span>
                  <p><code>/api/recognitions</code> accepts <code>{'{ image, selectedProfileId }'}</code> and returns a matched profile plus confidence.</p>
                </div>
                <div className="integration-item">
                  <span>POST</span>
                  <p><code>/api/attacks/fgsm</code> accepts <code>{'{ image, targetProfileId, epsilon }'}</code> and returns attack outputs.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      <Analytics />
    </>
  )
}

export default App
