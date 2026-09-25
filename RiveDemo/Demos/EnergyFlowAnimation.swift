import SwiftUI

import RiveRuntime

struct EnergyAnimationView: View {
    private let viewModel = RiveViewModel(fileName: "daytonight")
    @State private var hasSolar = true
    @State private var isDay = true
    var body: some View {
        VStack {
            viewModel.view()
                .frame(height: 400)
                .padding()
            
        }
        .onAppear{
            updateRiveInputs()
        }
       
        .ignoresSafeArea(.all)
    }

    private func updateRiveInputs() {
        viewModel.setInput("hasSolar", value: hasSolar)
        viewModel.setInput("isDay", value: isDay)
    }
}

struct EnergyAnimationView_Previews: PreviewProvider {
    static var previews: some View {
        EnergyAnimationView()
    }
}

 
