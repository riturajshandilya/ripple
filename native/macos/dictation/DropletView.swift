import AppKit
import Foundation
import SwiftUI

// MARK: - OKLab Color Representation & Perceptual Blending

public struct OKLab: Equatable {
    public var L: CGFloat
    public var a: CGFloat
    public var b: CGFloat
    public var alpha: CGFloat

    public init(L: CGFloat, a: CGFloat, b: CGFloat, alpha: CGFloat = 1.0) {
        self.L = L
        self.a = a
        self.b = b
        self.alpha = alpha
    }

    public init(hex: UInt32, alpha: CGFloat = 1.0) {
        let r = CGFloat((hex >> 16) & 0xff) / 255.0
        let g = CGFloat((hex >> 8) & 0xff) / 255.0
        let b = CGFloat(hex & 0xff) / 255.0
        self.init(r: r, g: g, b: b, alpha: alpha)
    }

    public init(r: CGFloat, g: CGFloat, b: CGFloat, alpha: CGFloat = 1.0) {
        func toLinear(_ c: CGFloat) -> CGFloat {
            c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        let lr = toLinear(r)
        let lg = toLinear(g)
        let lb = toLinear(b)

        let l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
        let m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
        let s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

        let l_ = cbrt(max(0, l))
        let m_ = cbrt(max(0, m))
        let s_ = cbrt(max(0, s))

        self.L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
        self.a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
        self.b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        self.alpha = alpha
    }

    public var color: Color {
        let l_ = L + 0.3963377774 * a + 0.2158037573 * b
        let m_ = L - 0.1055613458 * a - 0.0638541728 * b
        let s_ = L - 0.0894841775 * a - 1.2914855480 * b

        let l = l_ * l_ * l_
        let m = m_ * m_ * m_
        let s = s_ * s_ * s_

        let lr = +4.0767439362 * l - 3.3077115913 * m + 0.2309699295 * s
        let lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
        let lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

        func toSRGB(_ c: CGFloat) -> CGFloat {
            let clamped = max(0.0, min(1.0, c))
            return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * pow(clamped, 1.0 / 2.4) - 0.055
        }

        return Color(
            red: Double(toSRGB(lr)),
            green: Double(toSRGB(lg)),
            blue: Double(toSRGB(lb)),
            opacity: Double(alpha)
        )
    }

    public static func mix(from: OKLab, to: OKLab, t: CGFloat) -> OKLab {
        let clampedT = max(0.0, min(1.0, t))
        return OKLab(
            L: from.L + clampedT * (to.L - from.L),
            a: from.a + clampedT * (to.a - from.a),
            b: from.b + clampedT * (to.b - from.b),
            alpha: from.alpha + clampedT * (to.alpha - from.alpha)
        )
    }
}

// MARK: - Droplet Phases

public enum DropletPhase: String, CaseIterable {
    case idle
    case listening
    case transcribing
    case polishing
    case success
    case error
}

// MARK: - Audio Features

public struct DropletAudioFeatures: Equatable {
    public var energy: CGFloat
    public var low: CGFloat
    public var high: CGFloat

    public init(energy: CGFloat = 0.0, low: CGFloat = 0.0, high: CGFloat = 0.0) {
        self.energy = energy
        self.low = low
        self.high = high
    }
}

// MARK: - Configurable Render Layers

public struct DropletLayers {
    public var showShadow: Bool = true
    public var showHighlight: Bool = true
    public var showRim: Bool = true

    public init(
        showShadow: Bool = true,
        showHighlight: Bool = true,
        showRim: Bool = true
    ) {
        self.showShadow = showShadow
        self.showHighlight = showHighlight
        self.showRim = showRim
    }
}

// MARK: - Mathematical Modeling & Noise Engine

public enum DropletMath {
    /// Asymmetric audio envelope follower
    public static func updateAudioFollower(
        rawDb: Float,
        peakDb: Float,
        energy: inout CGFloat,
        low: inout CGFloat,
        high: inout CGFloat
    ) {
        let avgNorm = pow(CGFloat(max(-55.0, min(0.0, rawDb)) + 55.0) / 55.0, 1.35)
        let peakNorm = pow(CGFloat(max(-55.0, min(0.0, peakDb)) + 55.0) / 55.0, 1.35)

        // energy (mid band)
        if avgNorm > energy {
            energy += 0.45 * (avgNorm - energy)
        } else {
            energy += 0.12 * (avgNorm - energy)
        }

        // low (slow body envelope)
        if avgNorm > low {
            low += 0.18 * (avgNorm - low)
        } else {
            low += 0.05 * (avgNorm - low)
        }

        // high (transient shimmer)
        let transient = max(0, peakNorm - avgNorm) * 2.2
        if transient > high {
            high += 0.60 * (transient - high)
        } else {
            high += 0.25 * (transient - high)
        }
    }

    /// Deterministic 3D Periodic Noise on Unit Circle (Zero heap allocations, zero random())
    public static func samplePeriodicNoise(theta: CGFloat, z: CGFloat) -> CGFloat {
        let x = cos(theta)
        let y = sin(theta)

        // Octave 1: Macro fluid contour (f = 1.0)
        let n1 = sin(x * 1.8 + cos(z * 0.8)) * cos(y * 1.8 + sin(z * 0.6))

        // Octave 2: Formant ripples (f = 2.0, lacunarity = 2.0, persistence = 0.5)
        let z2 = z * 1.4 + 1.731
        let n2 = sin(x * 3.6 + sin(z2 * 0.9)) * cos(y * 3.6 + cos(z2 * 0.7))

        // Octave 3: Fine capillary shimmer (f = 4.0)
        let z3 = z * 2.2 + 3.141
        let n3 = cos(x * 7.2 - cos(z3 * 1.2)) * sin(y * 7.2 + sin(z3 * 1.1))

        // Weighted multi-octave summation (Normalized to [-1.0 .. 1.0])
        return 0.55 * n1 + 0.30 * n2 + 0.15 * n3
    }

    /// Catmull-Rom to Cubic Bézier closed loop smoothing
    public static func catmullRomClosedPath(points: [CGPoint]) -> Path {
        let n = points.count
        guard n >= 3 else { return Path() }
        var path = Path()
        path.move(to: points[0])
        for i in 0..<n {
            let p0 = points[(i - 1 + n) % n]
            let p1 = points[i]
            let p2 = points[(i + 1) % n]
            let p3 = points[(i + 2) % n]

            let cp1 = CGPoint(
                x: p1.x + (p2.x - p0.x) / 6.0,
                y: p1.y + (p2.y - p0.y) / 6.0
            )
            let cp2 = CGPoint(
                x: p2.x - (p3.x - p1.x) / 6.0,
                y: p2.y - (p3.y - p1.y) / 6.0
            )
            path.addCurve(to: p2, control1: cp1, control2: cp2)
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - Simulation Engine (Non-Published Reference Type)

public final class DropletSimulation {
    public static let nodeCount: Int = 28

    // Continuous time drift and frame delta
    public var z: CGFloat = 0.0
    public var lastDate: Date? = nil

    // Asymmetric noise amplitude follower
    public var noiseAmp: CGFloat = 0.0

    // Radii
    public var targetRadius: CGFloat = 10.0
    public var currentRadius: CGFloat = 10.0

    // Center offset for damped error wobble
    public var centerOffset: CGPoint = .zero

    // Pre-allocated node buffer for zero-allocation 60fps evaluation
    public var points: [CGPoint] = Array(repeating: .zero, count: nodeCount)

    public init() {}

    public func reset() {
        z = 0.0
        lastDate = nil
        noiseAmp = 0.0
        targetRadius = 10.0
        currentRadius = 10.0
        centerOffset = .zero
    }

    public func step(
        dt: CGFloat,
        features: DropletAudioFeatures,
        phase: DropletPhase,
        targetR: CGFloat,
        elapsedInPhase: CFTimeInterval,
        time: CFTimeInterval
    ) {
        let clampedDt = min(0.033, max(0.001, dt))
        self.targetRadius = targetR

        // 1. Fluid drift rate dz/dt
        let driftSpeed: CGFloat
        switch phase {
        case .listening:
            driftSpeed = 0.45 + 0.85 * features.energy
        case .transcribing, .polishing:
            driftSpeed = 0.35
        case .idle, .success, .error:
            driftSpeed = 0.0
        }
        z += clampedDt * driftSpeed

        // 2. Asymmetric noise amplitude follower
        let targetAmp: CGFloat = (phase == .listening) ? features.energy : 0.0
        let alpha: CGFloat = (targetAmp > noiseAmp) ? min(1.0, clampedDt / 0.03) : min(1.0, clampedDt / 0.18)
        noiseAmp += (targetAmp - noiseAmp) * alpha

        // 3. Smooth global radius follower
        currentRadius += (targetRadius - currentRadius) * min(1.0, clampedDt * 12.0)

        // 4. Center offset (Error phase damped wobble)
        if phase == .error {
            let elapsed = CGFloat(elapsedInPhase)
            let wobble = 4.0 * exp(-6.0 * elapsed) * cos(2.0 * .pi * 12.0 * elapsed)
            centerOffset = CGPoint(x: wobble, y: 0.0)
        } else {
            centerOffset = .zero
        }
    }

    public func simulateTo(
        time: CFTimeInterval,
        features: DropletAudioFeatures,
        phase: DropletPhase,
        targetR: CGFloat
    ) {
        let driftSpeed: CGFloat = (phase == .listening) ? (0.45 + 0.85 * features.energy) : 0.35
        self.z = CGFloat(time) * driftSpeed
        self.targetRadius = targetR
        self.currentRadius = targetR
        self.noiseAmp = (phase == .listening) ? features.energy : 0.0
        if phase == .error {
            let elapsed = CGFloat(time)
            let wobble = 4.0 * exp(-6.0 * elapsed) * cos(2.0 * .pi * 12.0 * elapsed)
            self.centerOffset = CGPoint(x: wobble, y: 0.0)
        } else {
            self.centerOffset = .zero
        }
    }

    public func buildContourPath(
        center: CGPoint,
        phase: DropletPhase,
        features: DropletAudioFeatures,
        reduceMotion: Bool
    ) -> Path {
        if reduceMotion {
            let r = currentRadius
            return Path(ellipseIn: CGRect(x: center.x - r, y: center.y - r, width: r * 2.0, height: r * 2.0))
        }

        let n = Self.nodeCount
        let baseR = currentRadius

        for i in 0..<n {
            let theta = CGFloat(i) / CGFloat(n) * 2.0 * .pi
            let r: CGFloat

            switch phase {
            case .idle:
                r = baseR

            case .listening:
                let noiseVal = DropletMath.samplePeriodicNoise(theta: theta, z: z)
                let squash = 0.08 * features.low * (-cos(2.0 * theta))
                r = baseR * (1.0 + squash + 0.22 * noiseAmp * noiseVal)

            case .transcribing:
                let breathing = 0.05 * cos(2.0 * theta) * sin(2.0 * .pi * 0.8 * z)
                let residualNoise = 0.03 * DropletMath.samplePeriodicNoise(theta: theta, z: z)
                r = baseR * (1.0 + breathing + residualNoise)

            case .polishing:
                let harmonic = 0.06 * cos(4.0 * theta) * sin(2.0 * .pi * 0.7 * z)
                let residualNoise = 0.02 * DropletMath.samplePeriodicNoise(theta: theta, z: z)
                r = baseR * (1.0 + harmonic + residualNoise)

            case .success, .error:
                r = baseR
            }

            points[i] = CGPoint(x: center.x + r * cos(theta), y: center.y + r * sin(theta))
        }

        return DropletMath.catmullRomClosedPath(points: points)
    }

    public func isSettled(phase: DropletPhase, colorProgress: CGFloat) -> Bool {
        guard phase == .idle else { return false }
        guard abs(currentRadius - 10.0) < 0.05 else { return false }
        guard noiseAmp < 0.005 else { return false }
        guard abs(centerOffset.x) < 0.05 else { return false }
        guard colorProgress >= 1.0 else { return false }
        return true
    }
}

// MARK: - Droplet Observable State Model

public final class DropletModel: ObservableObject {
    @Published public var phase: DropletPhase = .idle
    @Published public var isCompact: Bool = true
    @Published public var isAnimating: Bool = true

    public var phaseChangedAt: CFTimeInterval = Date.timeIntervalSinceReferenceDate
    public var fromColor: OKLab
    public var toColor: OKLab
    public var transitionDuration: CGFloat = 0.28

    // Audio features written by 60Hz meter
    public var energy: CGFloat = 0
    public var low: CGFloat = 0
    public var high: CGFloat = 0

    public var features: DropletAudioFeatures {
        DropletAudioFeatures(energy: energy, low: low, high: high)
    }

    // Simulation engine instance
    public let simulation = DropletSimulation()

    public var currentRadius: CGFloat {
        simulation.currentRadius
    }

    public var reduceMotion: Bool {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    }

    public init() {
        let idleColor = OKLab(hex: 0x1C1E26, alpha: 0.88)
        self.fromColor = idleColor
        self.toColor = idleColor
    }

    public func setPhase(_ newPhase: DropletPhase) {
        guard newPhase != phase else { return }
        let now = Date.timeIntervalSinceReferenceDate
        fromColor = currentColor(at: now)
        toColor = targetColor(for: newPhase)
        phase = newPhase
        phaseChangedAt = now
        transitionDuration = (newPhase == .transcribing) ? 0.28 : 0.22
        isAnimating = true
        simulation.lastDate = nil
    }

    public func targetColor(for phase: DropletPhase) -> OKLab {
        switch phase {
        case .idle:
            return OKLab(hex: 0x1C1E26, alpha: 0.88)
        case .listening:
            return OKLab(hex: 0x55D7F2, alpha: 0.92)
        case .transcribing:
            return OKLab(hex: 0x8E6CFF, alpha: 0.92)
        case .polishing:
            return OKLab(hex: 0x8E6CFF, alpha: 0.94)
        case .success:
            return OKLab(hex: 0x34D399, alpha: 0.96)
        case .error:
            return OKLab(hex: 0xFB7185, alpha: 0.95)
        }
    }

    public func currentColor(at time: CFTimeInterval) -> OKLab {
        let elapsed = CGFloat(max(0, time - phaseChangedAt))
        let progress = min(1.0, elapsed / max(0.01, transitionDuration))
        var base = OKLab.mix(from: fromColor, to: toColor, t: progress)

        if phase == .listening {
            let energyBlend = smoothstep(0.55, 0.90, energy)
            if energyBlend > 0 {
                let violet = OKLab(hex: 0x8E6CFF, alpha: 0.95)
                base = OKLab.mix(from: base, to: violet, t: energyBlend)
            }
        } else if phase == .success {
            if elapsed > 0.18 {
                let fadeT = min(1.0, (elapsed - 0.18) / 0.32)
                let idle = OKLab(hex: 0x1C1E26, alpha: 0.88)
                base = OKLab.mix(from: base, to: idle, t: fadeT)
            }
        }
        return base
    }

    public func targetRadius(at time: CFTimeInterval) -> CGFloat {
        switch phase {
        case .idle:
            return 10.0
        case .listening:
            if energy < 0.04 && !reduceMotion {
                // Gentle ±1.2 pt breathing in silence at 0.5 Hz
                return 25.0 + 1.2 * sin(CGFloat(time) * (2.0 * .pi * 0.5))
            }
            return min(32.0, 25.0 + 5.0 * energy)
        case .transcribing:
            return 24.0
        case .polishing:
            return 26.0
        case .success:
            let elapsed = time - phaseChangedAt
            if elapsed > 0.18 {
                let t = CGFloat(min(1.0, (elapsed - 0.18) / 0.32))
                return 22.0 + t * (10.0 - 22.0)
            }
            return 22.0
        case .error:
            return 25.0
        }
    }

    private func smoothstep(_ edge0: CGFloat, _ edge1: CGFloat, _ x: CGFloat) -> CGFloat {
        let t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
        return t * t * (3.0 - 2.0 * t)
    }
}

// MARK: - SwiftUI Droplet View (Canvas inside Pausable TimelineView)

public struct DropletView: View {
    @ObservedObject public var model: DropletModel
    public var layers: DropletLayers = DropletLayers()
    public var fixedTime: CFTimeInterval? = nil

    public init(model: DropletModel, layers: DropletLayers = DropletLayers(), fixedTime: CFTimeInterval? = nil) {
        self.model = model
        self.layers = layers
        self.fixedTime = fixedTime
    }

    public var body: some View {
        if let fixedTime {
            Canvas { context, size in
                drawFrame(context: context, size: size, time: fixedTime, dt: 1.0 / 60.0)
            }
            .frame(width: 120, height: 120)
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: !model.isAnimating)) { timeline in
                Canvas { context, size in
                    let dt: CGFloat
                    if let last = model.simulation.lastDate {
                        dt = CGFloat(timeline.date.timeIntervalSince(last))
                    } else {
                        dt = 1.0 / 60.0
                    }
                    model.simulation.lastDate = timeline.date
                    let now = timeline.date.timeIntervalSinceReferenceDate
                    drawFrame(context: context, size: size, time: now, dt: dt)
                }
            }
            .frame(width: 120, height: 120)
        }
    }

    private func drawFrame(context: GraphicsContext, size: CGSize, time: CFTimeInterval, dt: CGFloat) {
        let elapsedInPhase = time - model.phaseChangedAt
        let targetR = model.targetRadius(at: time)

        if fixedTime == nil {
            model.simulation.step(
                dt: dt,
                features: model.features,
                phase: model.phase,
                targetR: targetR,
                elapsedInPhase: elapsedInPhase,
                time: time
            )
        } else {
            model.simulation.simulateTo(
                time: time,
                features: model.features,
                phase: model.phase,
                targetR: targetR
            )
        }

        let center = CGPoint(
            x: size.width / 2.0 + model.simulation.centerOffset.x,
            y: size.height / 2.0 + model.simulation.centerOffset.y
        )
        let stateOKLab = model.currentColor(at: time)
        let stateColor = stateOKLab.color

        let bodyPath = model.simulation.buildContourPath(
            center: center,
            phase: model.phase,
            features: model.features,
            reduceMotion: model.reduceMotion
        )

        // --- Layer 1: Contact Shadow & Liquid Body ---
        if layers.showShadow {
            context.drawLayer { ctx in
                ctx.addFilter(.shadow(color: .black.opacity(0.30), radius: 6, x: 0, y: 2))
                ctx.fill(bodyPath, with: .color(stateColor.opacity(model.reduceMotion ? 0.88 : 0.94)))
            }
        } else {
            context.fill(bodyPath, with: .color(stateColor.opacity(model.reduceMotion ? 0.88 : 0.94)))
        }

        // --- Layer 2: Clipped Meniscus Highlight & Specular Rim ---
        if layers.showHighlight && !model.reduceMotion {
            context.drawLayer { ctx in
                ctx.clip(to: bodyPath)
                let R = model.simulation.currentRadius
                let hlCenter = CGPoint(x: center.x - R * 0.28, y: center.y - R * 0.22)
                let hlW = R * 0.52
                let hlH = R * 0.26
                let hlPath = Path(ellipseIn: CGRect(x: hlCenter.x - hlW / 2.0, y: hlCenter.y - hlH / 2.0, width: hlW, height: hlH))
                ctx.fill(hlPath, with: .color(.white.opacity(0.60)))
            }
        }

        if layers.showRim {
            context.stroke(bodyPath, with: .color(.white.opacity(0.22)), lineWidth: 1.0)
        }

        // Check settling when idle to pause TimelineView
        if fixedTime == nil && model.phase == .idle && model.isAnimating {
            let colorProg = CGFloat(min(1.0, (time - model.phaseChangedAt) / max(0.01, model.transitionDuration)))
            if model.simulation.isSettled(phase: model.phase, colorProgress: colorProg) {
                DispatchQueue.main.async {
                    if model.phase == .idle && model.isAnimating && model.simulation.isSettled(phase: model.phase, colorProgress: colorProg) {
                        model.isAnimating = false
                        model.simulation.lastDate = nil
                    }
                }
            }
        }
    }
}

// MARK: - AppKit Hosting Subclass for Circular Hit-Testing & Pass-Through

public final class DropletHostingView: NSHostingView<DropletView> {
    public weak var dropletModel: DropletModel?
    public var onTap: (() -> Void)?

    public override func hitTest(_ point: NSPoint) -> NSView? {
        guard let dropletModel else { return super.hitTest(point) }
        if dropletModel.isCompact {
            let center = NSPoint(x: bounds.midX, y: bounds.midY)
            let dx = point.x - center.x
            let dy = point.y - center.y
            let dist = sqrt(dx * dx + dy * dy)
            if dist > dropletModel.currentRadius + 6.0 {
                return nil // Clicks outside the drop radius pass through to the underlying app
            }
        }
        return super.hitTest(point)
    }

    public override func mouseDown(with event: NSEvent) {
        onTap?()
    }
}
