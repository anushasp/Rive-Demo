import SwiftUI
import RiveRuntime

enum UsageMeterStatus: String, CaseIterable, Identifiable {
    case overLimit = "Over limit"
    case trendingOver = "Trending over"
    case closeToOver = "Close to over"
    case onTrack = "On track"

    var id: String { rawValue }
}

final class UsageMeterRiveViewModel: RiveViewModel {
    private var dataBindingInstance: RiveDataBindingViewModel.Instance?

    private var currentUsage: Float = 332
    private var currentCap: Float = 2250
    private var currentProjected: Float = 2212
    private var currentIsLightMode = true
    private var currentTagValue: UsageMeterStatus = .onTrack

    init() {
        super.init(
            fileName: "usageTracker",
            stateMachineName: "State Machine 1",
            autoPlay: true
        )

        riveModel?.enableAutoBind { [weak self] instance in
            guard let self else { return }
            self.dataBindingInstance = instance
            self.applyCurrentValues()
        }
    }

    func updateMeter(
        usage: Float,
        cap: Float,
        projected: Float
    ) {
        currentUsage = usage
        currentCap = max(cap, 1)
        currentProjected = projected
        applyCurrentValues()
    }

    func setLightMode(_ isLightMode: Bool) {
        currentIsLightMode = isLightMode
        dataBindingInstance?
            .booleanProperty(fromPath: "isLightMode")?
            .value = isLightMode
    }

    func setTagValue(_ status: UsageMeterStatus) {
        currentTagValue = status
        dataBindingInstance?
            .enumProperty(fromPath: "tagValue")?
            .value = status.rawValue
    }

    private func applyCurrentValues() {
        guard let instance = dataBindingInstance else { return }

        instance.numberProperty(fromPath: "usage")?.value = currentUsage
        instance.numberProperty(fromPath: "cap")?.value = currentCap
        instance.numberProperty(fromPath: "projected")?.value = currentProjected
        instance.booleanProperty(fromPath: "isLightMode")?.value = currentIsLightMode
        instance.enumProperty(fromPath: "tagValue")?.value = currentTagValue.rawValue
    }
}

struct UsageMeterThemeDemoView: View {
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var riveViewModel = UsageMeterRiveViewModel()

    @State private var usage: Double = 332
    @State private var cap: Double = 2250
    @State private var projected: Double = 2212
    @State private var tagValue: UsageMeterStatus = .onTrack

    @State private var useSystemTheme = true
    @State private var manualLightMode = true

    private var riveIsLightMode: Bool {
        useSystemTheme ? colorScheme == .light : manualLightMode
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                riveViewModel
                    .view()
                    .frame(maxWidth: .infinity)
                    .frame(height: 200)

                VStack(spacing: 12) {
                    HStack {
                        Text("Rive Theme").font(.headline)
                        Spacer()
                        Text(riveIsLightMode ? "Light" : "Dark")
                            .fontWeight(.semibold)
                    }

                    Toggle("Follow System Theme", isOn: $useSystemTheme)

                    if !useSystemTheme {
                        Toggle("Light Mode", isOn: $manualLightMode)
                    }
                }

                Divider()

                HStack {
                    Text("Tag Value")
                    Spacer()

                    Picker("Tag Value", selection: $tagValue) {
                        ForEach(UsageMeterStatus.allCases) { status in
                            Text(status.rawValue).tag(status)
                        }
                    }
                    .pickerStyle(.menu)
                }

                Text("tagValue controls the progress-bar and dashed-line color in Rive.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Divider()

                meterSlider("Usage", value: $usage)
                meterSlider("Projected", value: $projected)
                meterSlider("Cap", value: $cap)

                HStack {
                                   Button("On Track") {
                                       usage = 332
                                       cap = 2250
                                       projected = 2212
                                       tagValue = .onTrack
                                       syncMeter()
                                   }

                                   Button("Trending") {
                                       usage = 1232
                                       cap = 2250
                                       projected = 2350
                                       tagValue = .trendingOver
                                       syncMeter()
                                   }

                                   Button("Over") {
                                       usage = 2336
                                       cap = 2250
                                       projected = 2350
                                       tagValue = .overLimit
                                       syncMeter()
                                       
                                   }
                               }
                               .buttonStyle(.bordered)
            }
            .padding()
        }
        .onAppear { syncAll() }
        .onChange(of: usage) { _, _ in syncMeter() }
        .onChange(of: projected) { _, _ in syncMeter() }
        .onChange(of: cap) { _, _ in syncMeter() }
        .onChange(of: tagValue) { _, newValue in
            riveViewModel.setTagValue(newValue)
        }
        .onChange(of: colorScheme) { _, _ in
            if useSystemTheme { syncTheme() }
        }
        .onChange(of: useSystemTheme) { _, _ in syncTheme() }
        .onChange(of: manualLightMode) { _, _ in
            if !useSystemTheme { syncTheme() }
        }
    }

    private func syncAll() {
        syncMeter()
        syncTheme()
        riveViewModel.setTagValue(tagValue)
    }

    private func syncMeter() {
        riveViewModel.updateMeter(
            usage: Float(usage),
            cap: Float(cap),
            projected: Float(projected)
        )
    }

    private func syncTheme() {
        riveViewModel.setLightMode(riveIsLightMode)
    }

    @ViewBuilder
    private func meterSlider(_ title: String, value: Binding<Double>) -> some View {
        VStack(spacing: 8) {
            HStack {
                Text(title)
                Spacer()
                Text("\(Int(value.wrappedValue)) kWh")
                    .fontWeight(.semibold)
            }

            Slider(value: value, in: 0...6000, step: 1)
        }
    }
}

#Preview("Light") {
    UsageMeterThemeDemoView()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    UsageMeterThemeDemoView()
        .preferredColorScheme(.dark)
}
