import ExpoModulesCore
import KSPlayer
import AVKit

// MARK: - KSPlayer Video View Module

public class CrispyKSPlayerModule: Module {
    public func definition() -> ModuleDefinition {
        Name("CrispyKSPlayer")
        
        View(CrispyKSVideoView.self) {
            Prop("source") { (view: CrispyKSVideoView, source: String?) in
                view.setSource(source)
            }
            
            Prop("headers") { (view: CrispyKSVideoView, headers: [String: String]?) in
                view.setHeaders(headers)
            }
            
            Prop("paused") { (view: CrispyKSVideoView, paused: Bool) in
                view.setPaused(paused)
            }
            
            Prop("rate") { (view: CrispyKSVideoView, rate: Double) in
                view.setRate(rate)
            }
            
            Prop("volume") { (view: CrispyKSVideoView, volume: Double) in
                view.setVolume(volume)
            }
            
            Prop("resizeMode") { (view: CrispyKSVideoView, mode: String?) in
                view.setResizeMode(mode ?? "contain")
            }
            
            Prop("metadata") { (view: CrispyKSVideoView, metadata: [String: String]?) in
                view.setMetadata(metadata)
            }
            
            Prop("playInBackground") { (view: CrispyKSVideoView, enabled: Bool) in
                view.setPlayInBackground(enabled)
            }
            
            OnViewDidUpdateProps { (view: CrispyKSVideoView) in
                view.applyProps()
            }
        }
    }
}

// MARK: - KSPlayer Video View

public class CrispyKSVideoView: IOSVideoPlayerView {
    
    // Props
    private var sourceStr: String?
    private var headers: [String: String]?
    private var isPaused: Bool = false
    private var rate: Double = 1.0
    private var volumeValue: Double = 1.0
    private var resizeModeVal: String = "contain"
    private var metadata: [String: String]?
    private var playInBackground: Bool = false
    
    private var hasLoaded: Bool = false
    private var duration: TimeInterval = 0
    private var videoWidth: Int = 0
    private var videoHeight: Int = 0
    
    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        super.init()
        setupView()
    }
    
    private func setupView() {
        backgroundColor = .black
        
        // Listen to play time change
        self.playTimeDidChange = { [weak self] (currentTime: TimeInterval, totalTime: TimeInterval) in
            self?.emitEvent("onProgress", [
                "currentTime": currentTime,
                "duration": totalTime
            ])
        }
    }
    
    // MARK: - Prop Setters
    
    public func setSource(_ source: String?) {
        self.sourceStr = source
    }
    
    public func setHeaders(_ headers: [String: String]?) {
        self.headers = headers
    }
    
    public func setPaused(_ paused: Bool) {
        self.isPaused = paused
        guard hasLoaded, let player = self.playerLayer?.player else { return }
        
        if paused {
            player.pause()
        } else {
            player.play()
        }
    }
    
    public func setRate(_ rate: Double) {
        self.rate = rate
        self.playerLayer?.player.playbackRate = Float(rate)
    }
    
    public func setVolume(_ volume: Double) {
        self.volumeValue = volume
        // Volume is typically set on the view or the specific player implementation.
        // We use dynamic access to avoid compile-time errors if the member moved.
        let volumeFloat = Float(volume)
        if self.responds(to: NSSelectorFromString("setVolume:")) {
            // Using a dynamic cast to AnyObject to set the property if it exists
            (self as AnyObject).volume = volumeFloat
        }
    }
    
    public func setResizeMode(_ mode: String) {
        self.resizeModeVal = mode
        updateVideoGravity()
    }
    
    public func setMetadata(_ metadata: [String: String]?) {
        self.metadata = metadata
    }
    
    public func setPlayInBackground(_ enabled: Bool) {
        self.playInBackground = enabled
        configureAudioSession()
    }
    
    public func applyProps() {
        loadSource()
    }
    
    private func loadSource() {
        guard let source = sourceStr, let url = URL(string: source) else {
            return
        }
        
        let options = KSOptions()
        options.isSecondOpen = false
        options.isAccurateSeek = true
        options.isLoopPlay = false
        options.startPlayRate = Float(rate)
        
        // Add headers if provided
        if let headers = headers {
            options.appendHeader(headers)
        }
        
        let name = metadata?["title"] ?? url.lastPathComponent
        let resource = KSPlayerResource(url: url, options: options, name: name)
        
        self.set(resource: resource)
        
        configureAudioSession()
        
        if !isPaused {
            // Auto play is handled by set(resource) usually, but we can enforce
            // self.playerLayer?.player.play()
        } else {
             self.playerLayer?.player.pause()
        }
        
        hasLoaded = true
    }
    
    private func configureAudioSession() {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            let category: AVAudioSession.Category = playInBackground ? .playback : .ambient
            try audioSession.setCategory(category, mode: .moviePlayback, options: [.allowAirPlay, .allowBluetooth])
            try audioSession.setActive(true)
        } catch {
            print("[CrispyKSVideoView] Audio session error: \(error)")
        }
    }
    
    private func updateVideoGravity() {
        let gravity: AVLayerVideoGravity
        switch resizeModeVal {
        case "cover":
            gravity = .resizeAspectFill
        case "stretch":
            gravity = .resize
        case "contain", "original", _:
            gravity = .resizeAspect
        }
        
        // KSPlayer often allows setting gravity on the view or playerLayer
        if self.responds(to: NSSelectorFromString("setVideoGravity:")) {
            (self as AnyObject).videoGravity = gravity
        } else if let playerLayer = self.playerLayer, playerLayer.responds(to: NSSelectorFromString("setVideoGravity:")) {
            (playerLayer as AnyObject).videoGravity = gravity
        }
    }
    
    // MARK: - Public Methods
    
    public func seek(to positionSec: Double) {
        let targetTime = TimeInterval(positionSec)
        self.seek(time: targetTime) { _ in }
    }
    
    public func setAudioTrack(_ trackId: Int) {
        guard let player = self.playerLayer?.player else { return }
        let tracks = player.tracks(mediaType: .audio)
        if trackId < tracks.count {
            let track = tracks[trackId]
            player.select(track: track)
        }
    }
    
    public func setSubtitleTrack(_ trackId: Int) {
        guard let player = self.playerLayer?.player else { return }
        let tracks = player.tracks(mediaType: .subtitle)
        if trackId < tracks.count {
            let track = tracks[trackId]
            player.select(track: track)
        }
    }
    
    // MARK: - Player Delegate Overrides
    
    public override func player(layer: KSPlayerLayer, state: KSPlayerState) {
        super.player(layer: layer, state: state)
        
        switch state {
        case .readyToPlay:
            emitEvent("onReadyForDisplay", [:])
            let duration = layer.player.duration
            emitEvent("onLoad", [
                "duration": duration,
                "width": videoWidth,
                "height": videoHeight
            ])
        case .buffering:
            emitEvent("onBuffering", ["buffering": true])
        case .bufferFinished:
            emitEvent("onBuffering", ["buffering": false])
        case .stopped:
            emitEvent("onEnd", [:])
        case .error:
            emitEvent("onError", ["error": "Playback error"])
        default:
            break
        }
    }
    
    // MARK: - Event Emission
    
    private func emitEvent(_ name: String, _ body: [String: Any]) {
        // Events are emitted through the module's event system
        // Implementation depends on Expo Modules event handling
        // For now, this is a placeholder matching original code
    }
    
    public override func removeFromSuperview() {
        self.playerLayer?.player.pause()
        super.removeFromSuperview()
    }
}

