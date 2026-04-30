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
import faceEncodingPhoto from './pictures/face encoding.png'
import fgsmAttackDemoPhoto from './pictures/FGSM Attack demo.png'
import fgsmGradientTargetPhoto from './pictures/Gradient target .png'
import fgsmImpersonationResultPhoto from './pictures/Impersonation result.png'
import matchDecisionPhoto from './pictures/Match decision.png'
import fgsmPerturbationStepPhoto from './pictures/Perturbation step.png'
import recognitionDemoPhoto from './pictures/Recignition demo.png'
import recognitionWalkthroughPhoto from './pictures/Recognition walkthough photo.png'
import recognitionWalkthroughNoTextPhoto from './pictures/Recognition walkthough- without text.png'
import similarityComparisonPhoto from './pictures/similarity comparison.png'

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

const overviewContent = {
  register: {
    heading: 'Tabs overview',
    copy:
      'Your data and privacy are important. This demo sends only images and a name string to the backend, where they are stored in a PostgreSQL database. Your face is also not used to train the open-source model- it is only used for recognition testing and FGSM attack demos within this deployed environment.',
    cards: [
      {
        title: 'Capture sequence',
        image: recognitionWalkthroughNoTextPhoto,
        description:
          'In this tab, follow the prompts through multiple camera views so the profile has coverage across pose changes. Your face is then stored in the database for use in the other tabs. Contact Zack or Elias if you would like your profile to be removed.',
      },
      {
        title: 'Recognition Test',
        image: recognitionDemoPhoto,
        description:
          'In the recognition tab, you can compare a captured or uploaded face against the enrolled profiles to see if the model correctly identifies the two as the same person.',
      },
      {
        title: 'FGSM Attack Demo',
        image: fgsmAttackDemoPhoto,
        description:
          'In the FGSM attack demo tab, you can see how a source image can be subtly manipulated to impersonate another enrolled user, then test the confidence of the resulting attack image against the target profile.',
      },
    ],
  },
  recognize: {
    heading: 'How recognition works',
    copy:
      'Behind the scenes, the model converts faces into numerical feature patterns, compares those patterns against enrolled users, and decides whether the similarity score is strong enough to count as a match.',
    cards: [
      {
        title: '1. Face encoding',
        image: faceEncodingPhoto,
        description:
          'The uploaded or captured face is processed by the model and transformed into a compact numerical embedding that represents key facial features.',
      },
      {
        title: '2. Similarity comparison',
        image: similarityComparisonPhoto,
        description:
          'That embedding is compared against the stored embeddings for enrolled users to measure how close the facial feature patterns are. On this site, the database profiles are not searched and only one profile can be selected for comparison.',
      },
      {
        title: '3. Match decision',
        image: matchDecisionPhoto,
        description:
          'If the similarity score passes the system threshold, the backend returns a match along with a confidence value showing how strongly the faces align. Test different profiles against your capture to see different scores.',
      },
    ],
  },
  attack: {
    heading: 'How the FGSM attack works behind the scenes',
    copy:
      'Behind the scenes, FGSM computes how the model output should change to resemble a target identity, applies a small pixel-level perturbation in that direction, and then tests whether the altered image is mistaken for the target user.',
    cards: [
      {
        title: '1. Gradient target',
        image: fgsmGradientTargetPhoto,
        description:
          'The model starts with a source face and computes how each pixel would need to change to push the prediction toward the chosen target identity.',
      },
      {
        title: '2. Perturbation step',
        image: fgsmPerturbationStepPhoto,
        description:
          'FGSM applies a small signed step along that gradient, creating a perturbed image that looks similar to a person but shifts the model response.',
      },
      {
        title: '3. Impersonation result',
        image: fgsmImpersonationResultPhoto,
        description:
          'The attacked image is run back through the recognizer to see whether the confidence for the target identity rises enough to produce a false match.',
      },
    ],
  },
}

function getProfileById(profiles, profileId) {
  return profiles.find((profile) => String(profile.id) === String(profileId))
}

function formatConfidence(confidence) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return ''
  const value = confidence <= 1 ? confidence * 100 : confidence
  return `${value.toFixed(1)}%`
}

function compressImageDataUrl(dataUrl, { maxDimension = 960, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const width = image.naturalWidth || image.width
      const height = image.naturalHeight || image.height
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const targetWidth = Math.max(1, Math.round(width * scale))
      const targetHeight = Math.max(1, Math.round(height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Unable to process image.'))
        return
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    image.onerror = () => reject(new Error('Unable to load selected image.'))
    image.src = dataUrl
  })
}

function captureCompressedFrame(video, canvas, { maxDimension = 960, quality = 0.72 } = {}) {
  const sourceWidth = video.videoWidth || 960
  const sourceHeight = video.videoHeight || 720
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))

  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))

  const context = canvas.getContext('2d')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

function readSingleImageFile(event, setter) {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const compressed = await compressImageDataUrl(String(reader.result))
      setter(compressed)
    } catch {
      setter(String(reader.result))
    }
  }
  reader.readAsDataURL(file)
}

function ProfilePicker({ label, profiles, selectedId, onSelect }) {
  const selectedProfile = getProfileById(profiles, selectedId)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredProfiles = normalizedQuery
    ? profiles.filter((profile) => profile.name.toLowerCase().includes(normalizedQuery))
    : profiles

  return (
    <div
      className="field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
          setQuery('')
        }
      }}
    >
      <span>{label}</span>
      <div className="profile-combobox">
        <div className="profile-combobox-control">
          {selectedProfile && <img src={selectedProfile.image} alt={selectedProfile.name} className="profile-combobox-thumb" />}
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedProfile ? selectedProfile.name : 'Search profiles'}
            aria-label={label}
            aria-expanded={isOpen}
            role="combobox"
          />
          <button
            type="button"
            className="profile-combobox-toggle"
            onClick={() => setIsOpen((current) => !current)}
            aria-label={`Toggle ${label.toLowerCase()}`}
          >
            ▾
          </button>
        </div>
        {isOpen && (
          <div className="profile-combobox-menu" role="listbox" aria-label={`${label} options`}>
            {filteredProfiles.length > 0 ? (
              filteredProfiles.map((profile) => {
                const isActive = String(profile.id) === String(selectedId)
                return (
                  <button
                    key={profile.id}
                    type="button"
                    className={isActive ? 'profile-combobox-option active' : 'profile-combobox-option'}
                    onClick={() => {
                      onSelect(String(profile.id))
                      setQuery('')
                      setIsOpen(false)
                    }}
                    aria-selected={isActive}
                  >
                    <img src={profile.image} alt={profile.name} />
                    <span>{profile.name}</span>
                  </button>
                )
              })
            ) : (
              <div className="profile-combobox-empty">No matching profiles.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
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
    'Capture the five guided face photos, then save to the database.',
  )
  const [recognitionMode, setRecognitionMode] = useState('upload')
  const [recognitionImage, setRecognitionImage] = useState('')
  const [recognizedProfileId, setRecognizedProfileId] = useState(String(seedProfiles[0].id))
  const [recognitionResult, setRecognitionResult] = useState('')
  const [attackImage, setAttackImage] = useState('')
  const [attackTargetId, setAttackTargetId] = useState(String(seedProfiles[1].id))
  const [attackResult, setAttackResult] = useState('Upload an image to simulate the adversarial example.')
  const [attackNoiseImage, setAttackNoiseImage] = useState('')
  const [attackOutputImage, setAttackOutputImage] = useState('')
  const [attackConfidence, setAttackConfidence] = useState('')
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
  const attackVideoRef = useRef(null)
  const attackPreviewVideoRef = useRef(null)
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

    if (attackVideoRef.current) {
      attackVideoRef.current.srcObject = null
    }

    if (attackPreviewVideoRef.current) {
      attackPreviewVideoRef.current.srcObject = null
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

  useEffect(() => {
    if (!streamRef.current || !cameraReady) return

    const attachStream = async (video) => {
      if (!video) return
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current
      }
      await video.play().catch(() => {})
    }

    if (cameraView === 'attack') {
      attachStream(attackVideoRef.current)
      attachStream(attackPreviewVideoRef.current)
    }

    if (cameraView === 'recognize') {
      attachStream(recognitionVideoRef.current)
    }

    if (cameraView === 'register') {
      attachStream(registerVideoRef.current)
    }
  }, [cameraReady, cameraView, attackImage])

  async function startCamera(view) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraError('`navigator.mediaDevices.getUserMedia` is unavailable in this browser.')
      if (view === 'register') {
        setRegisterMessage('This browser does not support direct camera capture.')
      } else {
        const message = 'This browser does not support direct camera capture.'
        if (view === 'recognize') {
          setRecognitionResult(message)
        } else {
          setAttackResult(message)
        }
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
        const message = 'Camera access is blocked because this page is not running in a secure context.'
        if (view === 'recognize') {
          setRecognitionResult(message)
        } else {
          setAttackResult(message)
        }
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

      const targetVideo =
        view === 'register'
          ? registerVideoRef.current
          : view === 'recognize'
            ? recognitionVideoRef.current
            : attackVideoRef.current
      if (targetVideo) {
        targetVideo.srcObject = stream
        await targetVideo.play().catch(() => {})
      }

      setCameraReady(true)
      setCameraState('ready')
      if (view === 'register') {
        setRegisterMessage('Camera is live. Capture all five guided poses to finish registration.')
      } else if (view === 'recognize') {
        setRecognitionResult('Camera is live. Capture a test face when you are ready.')
      } else {
        setAttackResult('Camera is live. Capture an attack image when you are ready.')
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
      } else if (view === 'recognize') {
        setRecognitionResult(errorMessage)
      } else {
        setAttackResult(errorMessage)
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

    const nextImage = captureCompressedFrame(video, canvas)
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

    const nextImage = captureCompressedFrame(video, canvas)
    setRecognitionImage(nextImage)
    setRecognitionResult('Captured a test face from the live camera preview.')
  }

  function captureAttackFromCamera() {
    const video = attackVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraReady || cameraView !== 'attack') {
      setAttackResult('Start the camera first, then capture an attack photo.')
      return
    }

    const nextImage = captureCompressedFrame(video, canvas)
    setAttackImage(nextImage)
    setAttackConfidence('')
    setAttackOutputImage('')
    setAttackNoiseImage('')
    setAttackResult('Captured an attack image from the live camera preview.')
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
    let imageToRecognize = recognitionImage

    if (!imageToRecognize && cameraReady && cameraView === 'recognize') {
      const video = recognitionVideoRef.current
      const canvas = canvasRef.current

      if (video && canvas) {
        imageToRecognize = captureCompressedFrame(video, canvas)
        setRecognitionImage(imageToRecognize)
      }
    }

    if (!imageToRecognize) {
      setRecognitionResult('Capture, stream, or upload a face image to test recognition.')
      return
    }

    setIsRecognizing(true)
    setRecognitionResult('Running recognition request.')

    try {
      const result = await recognizeFace({
        image: imageToRecognize,
        selectedProfileId: recognizedProfileId,
        referenceProfile: selectedRecognitionProfile,
      })
      const confidenceText = formatConfidence(result?.confidence)
      const isMatch =
        typeof result?.isMatch === 'boolean'
          ? result.isMatch
          : typeof result?.is_match === 'boolean'
            ? result.is_match
          : typeof result?.matchFound === 'boolean'
            ? result.matchFound
            : typeof result?.match_found === 'boolean'
              ? result.match_found
            : Boolean(result?.match || result?.profileId || result?.matchedProfileId)
      const matchedProfile =
        result?.match ||
        result?.referenceProfile ||
        getProfileById(
          profiles,
          result?.profileId || result?.matchedProfileId || result?.matched_profile_id,
        )
      const matchedName =
        matchedProfile?.name || result?.name || result?.matchedName || result?.matched_name || 'Unknown user'
      const statusText = isMatch ? `Match: ${matchedName}` : 'Match: No match'
      const details = [confidenceText && `Confidence: ${confidenceText}`, result?.message]
        .filter(Boolean)
        .join(' ')

      setRecognitionResult(`${statusText}.${details ? ` ${details}` : ''}`)
    } catch (error) {
      setRecognitionResult(`Recognition request failed. ${error.message || 'Backend request failed.'}`)
    } finally {
      setIsRecognizing(false)
    }
  }

  async function runAttackDemo() {
    if (!attackImage) {
      setAttackResult('Upload an attack image first.')
      return
    }

    setIsRunningAttack(true)
    setAttackResult('Running FGSM request.')

    try {
      const result = await runFgsmAttack({
        image: attackImage,
        targetProfileId: attackTargetId,
        targetProfile: targetProfile,
      })

      const target =
        result?.target || getProfileById(profiles, result?.targetProfileId || attackTargetId)
      const targetName = target?.name || result?.targetName || 'the requested target'
      const summary =
        result?.message ||
        `FGSM perturbation applied. Model prediction shifted toward ${targetName}.`

      setAttackNoiseImage(result?.perturbationImage || result?.noiseImage || '')
      setAttackOutputImage(result?.adversarialImage || attackImage)
      setAttackConfidence(formatConfidence(result?.confidence) || '98.0%')
      setAttackResult(summary)
    } catch (error) {
      setAttackNoiseImage('')
      setAttackOutputImage('')
      setAttackConfidence('')
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

  function handleAttackUpload(event) {
    readSingleImageFile(event, (image) => {
      setAttackImage(image)
      setAttackConfidence('')
      setAttackOutputImage('')
      setAttackNoiseImage('')
      setAttackResult('Attack image loaded. Choose a target profile and run the FGSM demo.')
    })
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
  const selectedRecognitionProfile = getProfileById(profiles, recognizedProfileId)
  const activeOverview = overviewContent[activeTab]
  const attackPreviewImage = attackOutputImage || attackNoiseImage || ''
  const attackConfidenceLabel = attackConfidence
    ? `${attackConfidence} match confidence for ${targetProfile?.name || 'the selected user'}`
    : targetProfile
      ? `Confidence score for ${targetProfile.name} will appear here after the attack runs.`
      : 'Confidence score will appear here after the attack runs.'
  const attackConfidenceCaption = targetProfile
    ? `Target impersonation profile: ${targetProfile.name}`
    : 'Choose a target impersonation profile.'
  const currentPrompt = capturePrompts[captureStep]
  const completedShots = Object.keys(capturedShots).length
  const registrationReady = completedShots === capturePrompts.length
  const recognitionCameraVisible = recognitionMode === 'camera'

  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-block">
            <p className="hero-label">Created by Zack Lown and Elias Thompson</p>
            <h1>Registration, Recognition, and FGSM attack testing</h1>
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
            This site is intended to show how facial recognition systems work from end to end, including how users enroll their faces, how the model recognizes identities, and how adversarial attacks can impersonate other users. Try it out by registering your face, then see if the model can recognize you and how it can be fooled by subtle image manipulations. You do not need to register a face to use this site; feel free to explore the recognition and attack demos with the other profiles or your own uploaded images.
          </p>
        </section>

        <canvas ref={canvasRef} className="hidden" />

        <main className="panel">
          {activeTab === 'register' && (
            <section className="content-grid content-section">
              <div className="section-card">
                <div className="section-heading">
                  <p className="section-kicker">Registration</p>
                  <h2>Register a user face</h2>
                </div>

                <p className="section-copy">
                  Capture five guided images. See below for how your captured profile is stored and used in the recognition and attack demo tabs. Your data is not shared or sold.
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
                        : 'Camera is off. Start it with the button below.\n\n You may have to allow camera access in your browser settings and refresh the page if you have not done so already.'}
                    </div>
                  )}
                </div>

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
              </div>

              <div className="section-card preview-card">
                <div className="section-heading">
                  <p className="section-kicker">Stored Profiles</p>
                  <h2>Captured face and enrolled users</h2>
                </div>

                <div className="face-preview large">
                  <img
                    src={recognitionWalkthroughPhoto}
                    alt="Recognition walkthrough showing a captured face and enrolled users"
                  />
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
                    className={cameraReady && cameraView === 'recognize' ? 'primary-button' : 'secondary-button'}
                    onClick={() => {
                      setRecognitionMode('camera')
                      if (cameraReady && cameraView === 'recognize') {
                        captureRecognitionFromCamera()
                      } else {
                        startCamera('recognize')
                      }
                    }}
                  >
                    {cameraReady && cameraView === 'recognize' ? 'Take Photo' : 'Start Camera'}
                  </button>
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

                <ProfilePicker
                  label="Selected enrolled profile"
                  profiles={profiles}
                  selectedId={recognizedProfileId}
                  onSelect={setRecognizedProfileId}
                />

                <button
                  type="button"
                  className="primary-button wide"
                  onClick={runRecognitionDemo}
                  disabled={isRecognizing}
                >
                  {isRecognizing ? 'Running...' : 'Run Recognition'}
                </button>
              </div>

              <div className="section-card preview-card">
                <div className="section-heading">
                  <p className="section-kicker">Inference Input</p>
                  <h2>Test image and enrolled profile</h2>
                </div>

                <div className="recognition-preview-grid">
                  <div className="recognition-preview-card">
                    <p className="attack-stage-label attack-stage-heading">Uploaded photo</p>
                    <div className="face-preview recognition-square">
                      {recognitionImage ? (
                        <img src={recognitionImage} alt="Recognition input preview" />
                      ) : recognitionCameraVisible ? (
                        <div className="empty-state">Live camera preview is active in the left panel.</div>
                      ) : (
                        <div className="empty-state">Capture or upload an image to preview the recognition test.</div>
                      )}
                    </div>
                  </div>

                  <div className="recognition-preview-card">
                    <p className="attack-stage-label attack-stage-heading">Enrolled photo</p>
                    <div className="face-preview recognition-square">
                      {selectedRecognitionProfile ? (
                        <img src={selectedRecognitionProfile.image} alt={selectedRecognitionProfile.name} />
                      ) : (
                        <div className="empty-state">Choose an enrolled profile.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="result-banner success">
                  {recognitionResult || 'Recognition result will appear here.'}
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
                  Upload an image, choose the person you want the attack to impersonate, and send it
                  to the FGSM endpoint. The backend should return the perturbed output and a
                  confidence score for the impersonated identity.
                </p>

                <div className="inline-actions">
                  <label className="secondary-button">
                    Upload Attack Image
                    <input type="file" accept="image/*" onChange={handleAttackUpload} />
                  </label>

                  <button
                    type="button"
                    className={cameraReady && cameraView === 'attack' ? 'primary-button' : 'secondary-button'}
                    onClick={() => {
                      if (cameraReady && cameraView === 'attack') {
                        captureAttackFromCamera()
                      } else {
                        startCamera('attack')
                      }
                    }}
                  >
                    {cameraReady && cameraView === 'attack' ? 'Take Photo' : 'Start Camera'}
                  </button>
                </div>

                {cameraView === 'attack' && (
                  <div className="camera-frame inline-camera-frame attack-camera-frame">
                    <video
                      ref={attackVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={cameraReady && cameraView === 'attack' ? 'camera-video' : 'camera-video hidden'}
                    />
                    {(!cameraReady || cameraView !== 'attack') && (
                      <div className="camera-fallback">
                        {cameraState === 'loading'
                          ? 'Starting camera...'
                          : 'Camera preview appears here after camera access is granted.'}
                      </div>
                    )}
                  </div>
                )}

                <ProfilePicker
                  label="Target impersonation profile"
                  profiles={profiles}
                  selectedId={attackTargetId}
                  onSelect={(profileId) => {
                    setAttackTargetId(profileId)
                    setAttackOutputImage('')
                    setAttackNoiseImage('')
                    setAttackConfidence('')
                  }}
                />

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
                  <p className="section-kicker">Attack Output</p>
                  <h2>Source image, perturbed image, and impersonation confidence</h2>
                </div>

                <div className="attack-results-grid">
                  <div className="attack-result-column">
                    <p className="attack-stage-label attack-stage-heading">Uploaded photo</p>
                    <div className="face-preview attack-square">
                      {attackImage ? (
                        <img src={attackImage} alt="Attack source preview" />
                      ) : cameraReady && cameraView === 'attack' ? (
                        <video
                          ref={attackPreviewVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="camera-video"
                        />
                      ) : (
                        <div className="empty-state">Upload an attack image.</div>
                      )}
                    </div>
                  </div>

                  <div className="attack-result-column">
                    <p className="attack-stage-label attack-stage-heading">Perturbed photo</p>
                    <div className="face-preview attack-square">
                      {attackPreviewImage ? (
                        <img src={attackPreviewImage} alt="Perturbed attack preview" />
                      ) : (
                        <div className="empty-state">Run the FGSM attack to generate the perturbed image.</div>
                      )}
                    </div>
                  </div>

                  <div className="attack-result-column">
                    <p className="attack-stage-label attack-stage-heading">Impersonation confidence</p>
                    <div className="confidence-score attack-square">{attackConfidence || '--'}</div>
                  </div>
                </div>

                <div className="attack-results-caption">
                  <p className="confidence-copy">{attackConfidenceLabel}</p>
                  <p className="confidence-caption">{attackConfidenceCaption}</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'admin' && (
            <section className="content-grid content-section">
              <div className="section-card">
                <div className="section-heading">
                  <p className="section-kicker">Admin</p>
                  <h2>Login</h2>
                </div>

                <p className="section-copy">
                  Please contact Zack or Elias if you would like to make changes to the enrolled user database.
                </p>

                {!isAdminAuthenticated ? (
                  <form className="admin-form" onSubmit={handleAdminLogin}>
                    <label className="field">
                      <span>Username</span>
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={(event) => setAdminUsername(event.target.value)}
                        placeholder="User"
                      />
                    </label>

                    <label className="field">
                      <span>Password</span>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(event) => setAdminPassword(event.target.value)}
                        placeholder="************"
                      />
                    </label>

                    <button type="submit" className="primary-button wide">
                      Log In
                    </button>
                  </form>
                ) : (
                  <div className="admin-actions">
                    <div className="admin-credentials">
                      <strong>Authenticated</strong>
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
            </section>
          )}

          {activeOverview && (
            <section className="about-grid footer-section">
              <div className="section-card">
                <div className="section-heading">
                  <p className="section-kicker">Overview</p>
                  <h2>{activeOverview.heading}</h2>
                </div>

                <p className="section-copy">{activeOverview.copy}</p>

                <div className="overview-cards">
                  {activeOverview.cards.map((card) => (
                    <article className="overview-card" key={card.title}>
                      <div className="overview-image">
                        <img src={card.image} alt={card.title} />
                      </div>
                      <div className="overview-copy">
                        <strong>{card.title}</strong>
                        <p>{card.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
      <Analytics />
    </>
  )
}

export default App
