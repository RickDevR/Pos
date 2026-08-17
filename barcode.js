// Barcode utility helper module
const BarcodeEngine = {
    validate(code) {
        return typeof code === 'string' && code.length >= 2;
    }
};