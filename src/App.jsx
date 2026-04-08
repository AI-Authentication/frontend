import { useEffect, useRef, useState } from 'react'

const tabs = [
  { id: 'register', label: 'Register Face' },
  { id: 'recognize', label: 'Recognition Test' },
  { id: 'attack', label: 'FGSM Attack Demo' },
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
  const [registerMessage, setRegisterMessage] = useState(
    'Capture or upload a face to add a demo profile.',
  )
  const [recognitionImage, setRecognitionImage] = useState('')
  const [recognizedProfileId, setRecognizedProfileId] = useState(seedProfiles[0].id)
  const [recognitionResult, setRecognitionResult] = useState('')
  const [attackImage, setAttackImage] = useState('')
  const [attackTargetId, setAttackTargetId] = useState(seedProfiles[1].id)
  const [attackStrength, setAttackStrength] = useState(12)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      setCameraReady(false)
      if (activeTab !== 'register') {
        setCameraState('idle')
      }
    }
  }, [activeTab])

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraError('`navigator.mediaDevices.getUserMedia` is unavailable in this browser.')
      setRegisterMessage('This browser does not support direct camera capture. Use image upload.')
      return
    }

    if (!window.isSecureContext) {
      setCameraState('error')
      setCameraError(
        'Camera access requires a secure origin. Use `http://localhost` or `https://` instead of a raw local IP or file URL.',
      )
      setRegisterMessage('Camera access is blocked because this page is not running in a secure context.')
      return
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      setCameraState('loading')
      setCameraError('')

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

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }

      setCameraReady(true)
      setCameraState('ready')
      setRegisterMessage('Camera is live. Capture a photo or upload an image instead.')
    } catch (error) {
      setCameraReady(false)
      setCameraState('error')
      setCameraError(`${error?.name || 'UnknownError'}: ${error?.message || 'Camera request failed.'}`)
      setRegisterMessage(
        error?.name === 'NotAllowedError'
          ? 'Camera permission was blocked. Check the browser site settings, allow camera access, and retry.'
          : error?.name === 'NotFoundError'
            ? 'No camera device was found on this machine.'
            : error?.name === 'NotReadableError'
              ? 'The camera is already in use by another application.'
          : 'Camera could not be started. Retry or use image upload instead.',
      )
    }
  }

  function readImageFile(event, setter) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    if (files.length === 1) {
      const reader = new FileReader()
      reader.onload = () => setter(String(reader.result))
      reader.readAsDataURL(files[0])
      return
    }

    Promise.all(
      files.slice(0, capturePrompts.length).map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.readAsDataURL(file)
          }),
      ),
    ).then((images) => {
      const nextShots = {}
      images.forEach((image, index) => {
        nextShots[capturePrompts[index].id] = image
      })
      setCapturedShots(nextShots)
      setCapturedImage(nextShots.front || '')
      setCaptureStep(Math.min(images.length, capturePrompts.length - 1))
      setRegisterMessage(
        images.length === capturePrompts.length
          ? 'Five images loaded. Add a name and save the user.'
          : `Loaded ${images.length} image(s). ${capturePrompts[images.length]?.label || 'Continue capturing.'}`,
      )
    })
  }

  function captureFromCamera() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraReady) {
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

  function registerProfile() {
    if (!captureName.trim() || Object.keys(capturedShots).length < capturePrompts.length) {
      setRegisterMessage('A name and all five face images are required for registration.')
      return
    }

    const nextProfile = {
      id: Date.now(),
      name: captureName.trim(),
      image: capturedShots.front,
      photos: capturePrompts.map((prompt) => capturedShots[prompt.id]).filter(Boolean),
    }

    setProfiles((current) => [nextProfile, ...current])
    setRecognizedProfileId(nextProfile.id)
    setAttackTargetId(nextProfile.id)
    setCaptureName('')
    setCapturedImage('')
    setCapturedShots({})
    setCaptureStep(0)
    setRegisterMessage(`Profile saved for ${nextProfile.name}.`)
  }

  function runRecognitionDemo() {
    if (!recognitionImage) {
      setRecognitionResult('Upload a face image to test recognition.')
      return
    }

    const matchedUser = profiles.find((profile) => profile.id === recognizedProfileId)
    if (!matchedUser) {
      setRecognitionResult('No registered profiles are available yet.')
      return
    }

    setRecognitionResult(`Welcome ${matchedUser.name}. Confidence score: 98.2%`)
  }

  function runAttackDemo() {
    if (!attackImage) return 'Upload an input image to simulate the adversarial example.'

    const target = profiles.find((profile) => profile.id === attackTargetId)
    if (!target) return 'Select a target user for the attack output.'

    return `FGSM perturbation applied at epsilon ${attackStrength}. Model prediction shifted to ${target.name}.`
  }

  const attackResult = runAttackDemo()
  const targetProfile = profiles.find((profile) => profile.id === attackTargetId)
  const noiseOpacity = Math.min(0.18 + attackStrength / 64, 0.6)
  const currentPrompt = capturePrompts[captureStep]
  const completedShots = Object.keys(capturedShots).length
  const registrationReady = completedShots === capturePrompts.length
  const noiseStyle = {
    backgroundColor: '#091727',
    backgroundImage: `
      repeating-linear-gradient(0deg, rgba(47,127,249,${noiseOpacity}) 0 1px, transparent 1px 6px),
      repeating-linear-gradient(90deg, rgba(255,255,255,${noiseOpacity / 2}) 0 1px, transparent 1px 7px)
    `,
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="hero-label">Face Authentication Capstone</p>
          <h1>Registration, recognition, and attack testing</h1>
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
          The interface separates normal authentication from the FGSM attack scenario so the
          model behavior is easy to present. Current actions are mocked on the client while
          backend endpoints are still being integrated.
        </p>
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
                eyebrows up, and head down. The straight-on image is used as the preview photo.
              </p>

              <div className="camera-frame">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={cameraReady ? 'camera-video' : 'camera-video hidden'}
                />
                {!cameraReady && (
                  <div className="camera-fallback">
                    {cameraState === 'loading'
                      ? 'Starting camera...'
                      : 'Camera is off. Start it here or use image upload instead.'}
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

              <div className="actions">
                <button
                  type="button"
                  className={
                    registrationReady
                      ? 'secondary-button compact-button capture-button complete'
                      : 'primary-button compact-button capture-button'
                  }
                  onClick={cameraState === 'ready' ? captureFromCamera : startCamera}
                  disabled={registrationReady}
                >
                  {cameraState === 'ready' ? 'Capture Photo' : 'Start'}
                </button>
                <label className="secondary-button icon-button" title="Upload photos">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M20 16.5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-2" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="user"
                    onChange={(event) => readImageFile(event, setCapturedImage)}
                  />
                </label>
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
                disabled={!registrationReady}
              >
                Save To Database
              </button>

              <p className="status-text">{registerMessage}</p>
              <div className="camera-diagnostics">
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
                  <div className="empty-state">No face image selected yet.</div>
                )}
              </div>

              <div className="database-list">
                <div className="list-header">
                  <h3>Demo database</h3>
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
                Upload a face to simulate inference and choose which enrolled profile the mock
                model should match.
              </p>

              <label className="secondary-button">
                Upload Test Face
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => readImageFile(event, setRecognitionImage)}
                />
              </label>

              <label className="field">
                <span>Mock matched profile</span>
                <select
                  value={recognizedProfileId}
                  onChange={(event) => setRecognizedProfileId(Number(event.target.value))}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" className="primary-button wide" onClick={runRecognitionDemo}>
                Run Recognition
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
                ) : (
                  <div className="empty-state">Upload an image to preview the recognition test.</div>
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
                This panel explains how an adversarial perturbation can force the model toward
                the wrong enrolled identity. The perturbation itself is visualized conceptually
                in the frontend.
              </p>

              <label className="secondary-button">
                Upload Attack Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => readImageFile(event, setAttackImage)}
                />
              </label>

              <label className="field">
                <span>Target impersonation profile</span>
                <select
                  value={attackTargetId}
                  onChange={(event) => setAttackTargetId(Number(event.target.value))}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
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
                      <div className="empty-state">Source face image</div>
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
                      <strong>Raw noise</strong>
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
                    {targetProfile ? (
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

        <section className="about-grid footer-section">
          <div className="section-card">
            <div className="section-heading">
              <p className="section-kicker">Overview</p>
              <h2>What this site is demonstrating</h2>
            </div>

            <p className="section-copy">
              The capstone flow is intentionally split into registration, recognition, and
              adversarial attack sections so viewers can compare the trusted path against the
              manipulated path.
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
                <strong>Current scope</strong>
                <p>
                  This frontend focuses on UX, state flow, and presentation. Real model and
                  database integrations can be added afterward.
                </p>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-heading">
              <p className="section-kicker">Integration</p>
              <h2>Suggested integration points</h2>
            </div>

            <div className="integration-list">
              <div className="integration-item">
                <span>POST</span>
                <p>`/api/enroll-face` for uploading image data and saving profile metadata.</p>
              </div>
              <div className="integration-item">
                <span>POST</span>
                <p>`/api/recognize-face` for inference and confidence scores.</p>
              </div>
              <div className="integration-item">
                <span>POST</span>
                <p>`/api/run-fgsm` for generating adversarial examples against a target user.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
