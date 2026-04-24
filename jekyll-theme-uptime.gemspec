# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name          = "jekyll-theme-uptime"
  spec.version       = "0.1.0"
  spec.authors       = ["Salvador Fuentes Jr."]
  spec.email         = ["fuentesjr@gmail.com"]

  spec.summary       = "A dashboard-inspired Jekyll theme — warm orange, Fraunces serif, dark-first, with a ⌘K command palette."
  spec.homepage      = "https://github.com/fuentesjr/jekyll-theme-uptime"
  spec.license       = "MIT"

  spec.files = `git ls-files -z`.split("\x0").select do |f|
    f.match(%r{^(assets|_(includes|layouts|sass|data)/|(LICENSE|README)((\.(txt|md|markdown)|$)))}i)
  end

  spec.required_ruby_version = ">= 2.7"

  spec.add_runtime_dependency "jekyll", "~> 4.3"
  spec.add_runtime_dependency "jekyll-feed", "~> 0.17"
  spec.add_runtime_dependency "jekyll-seo-tag", "~> 2.8"

  spec.add_development_dependency "bundler", "~> 2.0"
end
