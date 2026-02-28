import SwiftUI

struct ContentView: View {
    @State private var showSettings = false
    
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            MainWebView()
                .edgesIgnoringSafeArea(.all)
            
            Button(action: {
                showSettings.toggle()
            }) {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.white)
                    .padding()
                    .background(Color(red: 0.9, green: 0, blue: 0.13)) // Pinterest Red
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.3), radius: 5, x: 0, y: 3)
            }
            .padding(.trailing, 20)
            .padding(.bottom, 40) // Floating above the tab bar in web view
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
        }
    }
}
