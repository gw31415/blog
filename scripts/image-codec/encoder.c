#include <avif/avif.h>
#include <stdlib.h>
#include <emscripten/emscripten.h>

typedef struct {
    avifEncoder *encoder;
    avifImage *image;
    avifRWData output;
    int still;
} Sequence;

EMSCRIPTEN_KEEPALIVE void sequence_destroy(Sequence *s) {
    if (!s) return;
    avifRWDataFree(&s->output);
    avifImageDestroy(s->image);
    avifEncoderDestroy(s->encoder);
    free(s);
}
EMSCRIPTEN_KEEPALIVE Sequence *sequence_create(int width, int height, int quality, int repetitions, int still) {
    if (width < 1 || height < 1 || width > 2560 || height > 2560) return NULL;
    Sequence *s = calloc(1, sizeof(Sequence));
    if (!s) return NULL;
    s->still = still;
    s->image = avifImageCreate(width, height, 8, AVIF_PIXEL_FORMAT_YUV420);
    s->encoder = avifEncoderCreate();
    if (!s->image || !s->encoder) { sequence_destroy(s); return NULL; }
    s->image->colorPrimaries = AVIF_COLOR_PRIMARIES_BT709;
    s->image->transferCharacteristics = AVIF_TRANSFER_CHARACTERISTICS_SRGB;
    s->image->matrixCoefficients = AVIF_MATRIX_COEFFICIENTS_BT601;
    s->image->yuvRange = AVIF_RANGE_FULL;
    s->encoder->timescale = 1000;
    s->encoder->repetitionCount = repetitions;
    s->encoder->maxThreads = 1;
    s->encoder->quality = quality;
    s->encoder->qualityAlpha = 100;
    s->encoder->speed = still ? 6 : 8;
    return s;
}
EMSCRIPTEN_KEEPALIVE int sequence_add(Sequence *s, uint8_t *pixels, int duration) {
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, s->image);
    rgb.format = AVIF_RGB_FORMAT_RGBA;
    rgb.pixels = pixels;
    rgb.rowBytes = s->image->width * 4;
    avifResult result = avifImageRGBToYUV(s->image, &rgb);
    if (result != AVIF_RESULT_OK) return result;
    return avifEncoderAddImage(s->encoder, s->image, duration, s->still ? AVIF_ADD_IMAGE_FLAG_SINGLE : AVIF_ADD_IMAGE_FLAG_NONE);
}
EMSCRIPTEN_KEEPALIVE int sequence_finish(Sequence *s) {
    return avifEncoderFinish(s->encoder, &s->output);
}
EMSCRIPTEN_KEEPALIVE uint8_t *sequence_data(Sequence *s) { return s->output.data; }
EMSCRIPTEN_KEEPALIVE int sequence_size(Sequence *s) { return s->output.size; }
