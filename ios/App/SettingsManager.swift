import Foundation
import Combine

class SettingsManager: ObservableObject {
    static let shared = SettingsManager()
    
    @Published var blockAds: Bool {
        didSet { UserDefaults.standard.set(blockAds, forKey: "blockAds") }
    }
    @Published var blockFastFashion: Bool {
        didSet { UserDefaults.standard.set(blockFastFashion, forKey: "blockFastFashion") }
    }
    @Published var blockAI: Bool {
        didSet { UserDefaults.standard.set(blockAI, forKey: "blockAI") }
    }
    @Published var hidePopups: Bool {
        didSet { UserDefaults.standard.set(hidePopups, forKey: "hidePopups") }
    }
    @Published var keyboardNav: Bool {
        didSet { UserDefaults.standard.set(keyboardNav, forKey: "keyboardNav") }
    }
    
    init() {
        self.blockAds = UserDefaults.standard.object(forKey: "blockAds") as? Bool ?? true
        self.blockFastFashion = UserDefaults.standard.object(forKey: "blockFastFashion") as? Bool ?? true
        self.blockAI = UserDefaults.standard.object(forKey: "blockAI") as? Bool ?? true
        self.hidePopups = UserDefaults.standard.object(forKey: "hidePopups") as? Bool ?? true
        self.keyboardNav = UserDefaults.standard.object(forKey: "keyboardNav") as? Bool ?? true
    }
}
