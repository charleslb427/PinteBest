import SwiftUI
import WebKit

struct MainWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        
        let coordinator = context.coordinator
        
        configuration.userContentController = userContentController
        
        // Persistent Website Data Store to keep login state
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        webView.scrollView.bounces = false
        
        coordinator.webView = webView
        coordinator.setupObserver()
        coordinator.injectScriptsAndLoad()
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Controlled via NotificationCenter in Coordinator
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject {
        weak var webView: WKWebView?
        
        func setupObserver() {
            NotificationCenter.default.addObserver(self, selector: #selector(injectScriptsAndLoad), name: NSNotification.Name("ReloadWebView"), object: nil)
        }
        
        @objc func injectScriptsAndLoad() {
            guard let webView = webView else { return }
            
            let settings = SettingsManager.shared
            let settingsJson = """
            {
                "blockAds": \(settings.blockAds),
                "blockFastFashion": \(settings.blockFastFashion),
                "blockAI": \(settings.blockAI),
                "hidePopups": \(settings.hidePopups),
                "keyboardNav": \(settings.keyboardNav)
            }
            """
            
            let polyfillScript = """
            window.pinterestPurifierSettings = \(settingsJson);
            window.chrome = window.chrome || {};
            window.chrome.storage = window.chrome.storage || {};
            window.chrome.storage.sync = {
                get: function(keys, callback) {
                    callback(window.pinterestPurifierSettings);
                },
                set: function(items, callback) {
                    if(callback) callback();
                }
            };
            """
            
            webView.configuration.userContentController.removeAllUserScripts()
            
            let polyfillUserScript = WKUserScript(source: polyfillScript, injectionTime: .atDocumentStart, forMainFrameOnly: false)
            webView.configuration.userContentController.addUserScript(polyfillUserScript)
            
            if let contentJsPath = Bundle.main.path(forResource: "content", ofType: "js"),
               let contentJsSource = try? String(contentsOfFile: contentJsPath) {
                let userScript = WKUserScript(source: contentJsSource, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
                webView.configuration.userContentController.addUserScript(userScript)
            }
            
            if webView.url == nil {
                let url = URL(string: "https://www.pinterest.com/")!
                webView.load(URLRequest(url: url))
            } else {
                webView.reload()
            }
        }
    }
}
