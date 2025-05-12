module.exports = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true, // Bisa diaktifkan jika ingin mempersulit debugging
    debugProtectionInterval: 0, // Interval untuk debug protection
    disableConsoleOutput: false, // Bisa diaktifkan untuk menonaktifkan console.log dll.
    identifierNamesGenerator: 'hexadecimal',  // 'mangled' juga bisa jadi pilihan
    log: false,
    numbersToExpressions: true,
    renameGlobals: false, // Penting untuk ekstensi browser agar tidak merusak interaksi dengan API browser
    selfDefending: true, // Membuat kode lebih sulit dimodifikasi
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['rc4'], // 'rc4' juga bisa, tapi base64 lebih umum
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    target: 'browser', // Pastikan targetnya browser
    transformObjectKeys: true,
    unicodeEscapeSequence: false // Lebih baik false untuk menghindari masalah encoding
}; 