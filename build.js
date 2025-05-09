const fs = require('fs-extra');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const obfuscatorConfig = require('./obfuscator.config.js');

const outputDir = path.join(__dirname, 'dist');
const scriptsDir = path.join(__dirname, 'scripts');
const popupDir = path.join(__dirname, 'popup');
const iconsDir = path.join(__dirname, 'icons');

const filesToObfuscate = [
    { input: path.join(scriptsDir, 'background.js'), output: path.join(outputDir, 'scripts', 'background.js') },
    { input: path.join(scriptsDir, 'content_script.js'), output: path.join(outputDir, 'scripts', 'content_script.js') },
    { input: path.join(popupDir, 'popup.js'), output: path.join(outputDir, 'popup', 'popup.js') }
];

const filesToCopy = [
    { input: path.join(__dirname, 'manifest.json'), output: path.join(outputDir, 'manifest.json') },
    { input: path.join(popupDir, 'popup.html'), output: path.join(outputDir, 'popup', 'popup.html') }
];

const directoriesToCopy = [
    { input: iconsDir, output: path.join(outputDir, 'icons') }
];

async function build() {
    try {
        // 1. Clean output directory
        console.log(`Cleaning ${outputDir}...`);
        await fs.remove(outputDir);
        console.log('Output directory cleaned.');

        // 2. Create output directories
        console.log('Creating output directories...');
        await fs.ensureDir(path.join(outputDir, 'scripts'));
        await fs.ensureDir(path.join(outputDir, 'popup'));
        console.log('Output directories created.');

        // 3. Obfuscate JavaScript files
        console.log('Obfuscating JavaScript files...');
        for (const file of filesToObfuscate) {
            console.log(`Obfuscating ${file.input}...`);
            const code = await fs.readFile(file.input, 'utf8');
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscatorConfig);
            await fs.writeFile(file.output, obfuscationResult.getObfuscatedCode());
            console.log(`Successfully obfuscated and saved to ${file.output}`);
        }
        console.log('JavaScript files obfuscated.');

        // 4. Copy other files
        console.log('Copying other necessary files...');
        for (const file of filesToCopy) {
            console.log(`Copying ${file.input} to ${file.output}...`);
            await fs.copy(file.input, file.output);
        }
        // Copy directories
        for (const dir of directoriesToCopy) {
            console.log(`Copying directory ${dir.input} to ${dir.output}...`);
            await fs.copy(dir.input, dir.output);
        }
        console.log('Files copied.');

        console.log('\nBuild process completed successfully!');
        console.log(`Distribution files are ready in ${outputDir}`);

    } catch (error) {
        console.error('Error during build process:', error);
        process.exit(1);
    }
}

build(); 