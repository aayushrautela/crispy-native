import ExpoModulesCore
import AVKit
import AVFoundation

public class CrispyNativeCoreModule: Module {
    private var pipController: AVPictureInPictureController?
    
    public func definition() -> ModuleDefinition {
        Name("CrispyNativeCore")
        
        // MARK: - Torrent Methods (No-op on iOS)
        
        AsyncFunction("startStream") { (infoHash: String, fileIdx: Int, sessionId: String) -> String? in
            print("[CrispyNativeCore] Torrent streaming not supported on iOS")
            return nil
        }
        
        AsyncFunction("destroyStream") { (sessionId: String) -> Void in
            print("[CrispyNativeCore] destroyStream: Torrent not supported on iOS")
        }
        
        AsyncFunction("stopTorrent") { (infoHash: String) -> Void in
            print("[CrispyNativeCore] stopTorrent: Torrent not supported on iOS")
        }
        
        AsyncFunction("destroyTorrent") { (infoHash: String) -> Void in
            print("[CrispyNativeCore] destroyTorrent: Torrent not supported on iOS")
        }
        
        AsyncFunction("clearCache") { () -> Void in
            print("[CrispyNativeCore] clearCache: Torrent not supported on iOS")
        }
        
        AsyncFunction("handleSeek") { (infoHash: String, fileIdx: Int, position: Double) -> Void in
            print("[CrispyNativeCore] handleSeek: Torrent not supported on iOS")
        }
        
        // MARK: - Picture-in-Picture
        
        AsyncFunction("enterPiP") { (width: Double?, height: Double?) -> Void in
            guard AVPictureInPictureController.isPictureInPictureSupported() else {
                print("[CrispyNativeCore] PiP not supported on this device")
                return
            }
            
            DispatchQueue.main.async {
                self.enterPiPMode()
            }
        }
        
        AsyncFunction("setPiPConfig") { (enabled: Bool, isPlaying: Bool, width: Double?, height: Double?) -> Bool in
            return AVPictureInPictureController.isPictureInPictureSupported()
        }
        
        AsyncFunction("isInPiPMode") { () -> Bool in
            return pipController?.isPictureInPictureActive ?? false
        }
        
        // MARK: - Native Player Activity (Stub for iOS - handled differently)
        
        AsyncFunction("openPlayerActivity") { (
            sessionId: String,
            url: String,
            headers: [String: String]?,
            engine: String,
            paused: Bool,
            title: String,
            subtitle: String,
            artworkUrl: String?
        ) -> Bool in
            print("[CrispyNativeCore] openPlayerActivity: Use JS player on iOS")
            return false
        }
        
        AsyncFunction("closePlayerActivity") { () -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetPaused") { (paused: Bool) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSeek") { (positionSec: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerLoad") { (
            url: String?,
            headers: [String: String]?,
            paused: Bool,
            title: String,
            subtitle: String,
            artworkUrl: String?
        ) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetRate") { (rate: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetVolume") { (volume: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetResizeMode") { (mode: String) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetAudioTrack") { (trackId: Int) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleTrack") { (trackId: Int) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleDelay") { (delaySec: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleSize") { (size: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleColor") { (color: String) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleBackgroundColor") { (color: String, opacity: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleBorderSize") { (size: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleBorderColor") { (color: String) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitlePosition") { (pos: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleBold") { (bold: Bool) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleItalic") { (italic: Bool) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetDecoderMode") { (mode: String) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetGpuMode") { (mode: String) -> Bool in
            return false
        }
        
        // MARK: - VLC View (primary iOS implementation)
        
        // VLC Removed for iOS
    }
    
    private func enterPiPMode() {
        guard let window = UIApplication.shared.keyWindow,
              let rootViewController = window.rootViewController else {
            return
        }
        
        // Find any active AVPlayerLayer
        if let playerLayer = findPlayerLayer(in: rootViewController.view) {
            if pipController == nil {
                pipController = AVPictureInPictureController(playerLayer: playerLayer)
            }
            pipController?.startPictureInPicture()
        }
    }
    
    private func findPlayerLayer(in view: UIView) -> AVPlayerLayer? {
        for subview in view.subviews {
            if let playerLayer = subview.layer as? AVPlayerLayer {
                return playerLayer
            }
            if let found = findPlayerLayer(in: subview) {
                return found
            }
        }
        return nil
    }
}

