import SwiftUI

struct SettingsView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var settings = SettingsManager.shared
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Filtres Pinterest Purifier").font(.headline)) {
                    Toggle("Anti-Pubs (Bloquer le sponsorisé)", isOn: $settings.blockAds)
                        .tint(Color(red: 0.9, green: 0, blue: 0.13))
                    Toggle("Anti-Fast Fashion (Temu, Shein...)", isOn: $settings.blockFastFashion)
                        .tint(Color(red: 0.9, green: 0, blue: 0.13))
                    Toggle("Anti-IA (Bloquer images générées)", isOn: $settings.blockAI)
                        .tint(Color(red: 0.9, green: 0, blue: 0.13))
                }
                
                Section(header: Text("Ergonomie").font(.headline)) {
                    Toggle("Anti-Dark Patterns (Popups forcés)", isOn: $settings.hidePopups)
                        .tint(Color(red: 0.9, green: 0, blue: 0.13))
                    Toggle("Navigation Clavier (Flèches)", isOn: $settings.keyboardNav)
                        .tint(Color(red: 0.9, green: 0, blue: 0.13))
                }
                
                Section(footer: Text("Développé avec Antigravity.\nCela rechargera la page pour appliquer les changements.")) {
                    Button(action: {
                        NotificationCenter.default.post(name: NSNotification.Name("ReloadWebView"), object: nil)
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Text("Recharger Pinterest")
                            .foregroundColor(Color(red: 0.9, green: 0, blue: 0.13))
                            .fontWeight(.bold)
                    }
                }
            }
            .navigationTitle("Paramètres")
            .navigationBarItems(trailing: Button("Fermer") {
                presentationMode.wrappedValue.dismiss()
            }.foregroundColor(.primary))
        }
    }
}
