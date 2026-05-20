// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "memory-wiki-quicklook",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "memory-wiki-quicklook",
            dependencies: [],
            path: "Sources/PreviewExtension",
            resources: [
                .copy("template.html")
            ]
        )
    ]
)
