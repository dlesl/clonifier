with import <nixpkgs> {};
stdenv.mkDerivation {
name = "clonifier";
buildInputs = [
    bashInteractive
    rustup
    wasm-pack
    nodejs-12_x
];
}
