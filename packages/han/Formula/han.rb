# typed: false
# frozen_string_literal: true

class Han < Formula
  desc "Sophisticated Claude Code Plugins with Superior Accuracy"
  homepage "https://han.guru"
  version "1.17.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/TheBushidoCollective/han/releases/download/v#{version}/han-darwin-arm64"
      sha256 "PLACEHOLDER_DARWIN_ARM64_SHA256"
    else
      url "https://github.com/TheBushidoCollective/han/releases/download/v#{version}/han-darwin-x64"
      sha256 "PLACEHOLDER_DARWIN_X64_SHA256"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/TheBushidoCollective/han/releases/download/v#{version}/han-linux-arm64"
      sha256 "PLACEHOLDER_LINUX_ARM64_SHA256"
    else
      url "https://github.com/TheBushidoCollective/han/releases/download/v#{version}/han-linux-x64"
      sha256 "PLACEHOLDER_LINUX_X64_SHA256"
    end
  end

  def install
    binary_name = "han"
    bin.install Dir["*"].first => binary_name
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/han --version")
  end
end
