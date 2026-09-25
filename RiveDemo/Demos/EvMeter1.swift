import SwiftUI
import RiveRuntime

import SwiftUI
import RiveRuntime

final class EVMeter1RiveViewModel: RiveViewModel {

    private var dataBindingInstance:
        RiveDataBindingViewModel.Instance?

    init() {
        super.init(
            fileName: "evmeterv1",
            stateMachineName: "state machine",
            autoPlay: true
        )

        riveModel?.enableAutoBind { [weak self] instance in
            self?.dataBindingInstance = instance
        }
    }

    func setCharging(_ value: Bool) {
        dataBindingInstance?
            .booleanProperty(fromPath: "chargingStatus")?
            .value = value
    }

    func setPercent(_ value: Float) {
        dataBindingInstance?
            .numberProperty(fromPath: "meterPercent")?
            .value = value
    }
}
// MARK: - SwiftUI Demo

struct EvMeter1AnimationView: View {

    @StateObject private var riveViewModel =
        EVMeter1RiveViewModel()

    @State private var chargingStatus = true
    @State private var meterPercent: Float = 76

    var body: some View {

        VStack(spacing: 24) {

            riveViewModel
                .view()
                .frame(
                    width: 300,
                    height: 300
                )

            Toggle(
                "Charging",
                isOn: $chargingStatus
            )
            .onChange(of: chargingStatus) { value in
                riveViewModel.setCharging(value)
            }

            HStack {
                Text("Battery")

                Spacer()

                Text("\(Int(meterPercent))%")
                    .fontWeight(.bold)
            }

            Slider(
                value: $meterPercent,
                in: 0...100,
                step: 1
            )
            .onChange(of: meterPercent) { value in
                riveViewModel.setPercent(value)
            }

            HStack {

                Button("10%") {
                    changePercent(10)
                }

                Button("25%") {
                    changePercent(25)
                }

                Button("50%") {
                    changePercent(50)
                }

                Button("76%") {
                    changePercent(76)
                }

                Button("90%") {
                    changePercent(90)
                }
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .onAppear {

            riveViewModel
                .setCharging(chargingStatus)

            riveViewModel
                .setPercent(meterPercent)
        }
    }

    private func changePercent(_ value: Float) {

        meterPercent = value

        riveViewModel
            .setPercent(value)
    }
}


#Preview {
    EvMeter1AnimationView()
}
