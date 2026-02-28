import SwiftUI
import WebKit

class WebCache {
    static let shared = WebCache()
    let processPool = WKProcessPool()
    let dataStore = WKWebsiteDataStore.default()
    
    init() {
        restoreCookies()
        
        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in
            self.saveCookies()
        }
    }
    
    func saveCookies() {
        dataStore.httpCookieStore.getAllCookies { cookies in
            var cookieDicts = [[String: Any]]()
            for cookie in cookies {
                if let props = cookie.properties {
                    var stringDict = [String: Any]()
                    for (key, value) in props {
                        stringDict[key.rawValue] = value
                    }
                    cookieDicts.append(stringDict)
                }
            }
            UserDefaults.standard.set(cookieDicts, forKey: "saved_cookies_dicts")
        }
    }
    
    func restoreCookies() {
        if let cookieDicts = UserDefaults.standard.array(forKey: "saved_cookies_dicts") as? [[String: Any]] {
            for dict in cookieDicts {
                var props = [HTTPCookiePropertyKey: Any]()
                for (key, value) in dict {
                    props[HTTPCookiePropertyKey(rawValue: key)] = value
                }
                if let cookie = HTTPCookie(properties: props) {
                    dataStore.httpCookieStore.setCookie(cookie, completionHandler: nil)
                }
            }
        }
    }
}

struct MainWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        
        let coordinator = context.coordinator
        
        configuration.userContentController = userContentController
        
        // Use a strictly shared process pool and data store to prevent session drop
        configuration.processPool = WebCache.shared.processPool
        configuration.websiteDataStore = WebCache.shared.dataStore
        
        // Implement the rules.json blocking natively
        let rulesBlockList = """
        [
            {
                "trigger": {
                    "url-filter": "ct\\\\.pinterest\\\\.com"
                },
                "action": {
                    "type": "block"
                }
            },
            {
                "trigger": {
                    "url-filter": "trk\\\\.pinterest\\\\.com"
                },
                "action": {
                    "type": "block"
                }
            }
        ]
        """
        
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: "PinterestBlocker",
            encodedContentRuleList: rulesBlockList) { (ruleList, error) in
                if let ruleList = ruleList {
                    configuration.userContentController.add(ruleList)
                }
        }
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        // Set standard user agent to avoid Google Login "disallowed_useragent" errors
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        webView.scrollView.bounces = false
        
        webView.uiDelegate = coordinator
        
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
    
    class Coordinator: NSObject, WKUIDelegate, WKNavigationDelegate {
        weak var webView: WKWebView?
        
        func setupObserver() {
            NotificationCenter.default.addObserver(self, selector: #selector(injectScriptsAndLoad), name: NSNotification.Name("ReloadWebView"), object: nil)
        }
        
        var popupWebViews = [WKWebView]()
        
        // Handle popups (like Google Login) by creating a new WKWebView over the current one
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            let newWebView = WKWebView(frame: webView.bounds, configuration: configuration)
            newWebView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            newWebView.uiDelegate = self
            newWebView.navigationDelegate = self
            newWebView.customUserAgent = webView.customUserAgent
            
            webView.addSubview(newWebView)
            popupWebViews.append(newWebView)
            return newWebView
        }
        
        func webViewDidClose(_ webView: WKWebView) {
            webView.removeFromSuperview()
            popupWebViews.removeAll(where: { $0 == webView })
        }
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            WebCache.shared.saveCookies()
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
