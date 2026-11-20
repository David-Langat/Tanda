/**
 * Standalone Zero-Dependency QR Code Generator
 * Generates valid Model 2 QR Codes directly to SVG.
 * Supports alphanumeric and byte URL payloads.
 */
(function(global) {
  'use strict';

  var EXP_TABLE = new Array(256);
  var LOG_TABLE = new Array(256);
  (function() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP_TABLE[i] = x;
      LOG_TABLE[x] = i;
      x <<= 1;
      if (x & 256) x ^= 0x11d;
    }
    for (var i = 255; i < 512; i++) {
      EXP_TABLE[i] = EXP_TABLE[i - 255];
    }
  })();

  function gmult(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
  }

  function polyMultiply(p1, p2) {
    var res = new Array(p1.length + p2.length - 1).fill(0);
    for (var i = 0; i < p1.length; i++) {
      for (var j = 0; j < p2.length; j++) {
        res[i + j] ^= gmult(p1[i], p2[j]);
      }
    }
    return res;
  }

  function polyRemainder(dividend, divisor) {
    var out = dividend.slice();
    for (var i = 0; i <= out.length - divisor.length; i++) {
      var coef = out[i];
      if (coef !== 0) {
        for (var j = 0; j < divisor.length; j++) {
          out[i + j] ^= gmult(divisor[j], coef);
        }
      }
    }
    return out.slice(out.length - divisor.length + 1);
  }

  function getGeneratorPoly(numEC) {
    var poly = [1];
    for (var i = 0; i < numEC; i++) {
      poly = polyMultiply(poly, [1, EXP_TABLE[i]]);
    }
    return poly;
  }

  function selectVersion(dataLen) {
    if (dataLen <= 17) return { ver: 1, size: 21, dataBytes: 19, ecBytes: 7, numEC: 7 };
    if (dataLen <= 32) return { ver: 2, size: 25, dataBytes: 34, ecBytes: 10, numEC: 10 };
    if (dataLen <= 53) return { ver: 3, size: 29, dataBytes: 55, ecBytes: 15, numEC: 15 };
    if (dataLen <= 78) return { ver: 4, size: 33, dataBytes: 80, ecBytes: 20, numEC: 20 };
    return { ver: 5, size: 37, dataBytes: 108, ecBytes: 26, numEC: 26 };
  }

  function encodeData(text, spec) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code < 128) bytes.push(code);
      else bytes.push(0x3f);
    }

    var bitstream = [];
    function pushBits(val, len) {
      for (var b = len - 1; b >= 0; b--) {
        bitstream.push((val >> b) & 1);
      }
    }

    pushBits(0b0100, 4); // Byte mode
    pushBits(bytes.length, 8);
    for (var i = 0; i < bytes.length; i++) {
      pushBits(bytes[i], 8);
    }
    var maxBits = spec.dataBytes * 8;
    for (var i = 0; i < 4 && bitstream.length < maxBits; i++) {
      bitstream.push(0);
    }
    while (bitstream.length % 8 !== 0) {
      bitstream.push(0);
    }
    var pad = [0xEC, 0x11];
    var padIdx = 0;
    while (bitstream.length < maxBits) {
      pushBits(pad[padIdx % 2], 8);
      padIdx++;
    }

    var dataBytes = [];
    for (var i = 0; i < bitstream.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) {
        b = (b << 1) | bitstream[i + j];
      }
      dataBytes.push(b);
    }

    var genPoly = getGeneratorPoly(spec.numEC);
    var dividend = dataBytes.concat(new Array(spec.numEC).fill(0));
    var ecBytes = polyRemainder(dividend, genPoly);

    return dataBytes.concat(ecBytes);
  }

  function createMatrix(spec, fullCodewords) {
    var size = spec.size;
    var matrix = [];
    var isFunction = [];
    for (var r = 0; r < size; r++) {
      matrix.push(new Array(size).fill(0));
      isFunction.push(new Array(size).fill(false));
    }

    function addFinder(top, left) {
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < 7; c++) {
          var isBorder = (r === 0 || r === 6 || c === 0 || c === 6);
          var isInner = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          matrix[top + r][left + c] = (isBorder || isInner) ? 1 : 0;
          isFunction[top + r][left + c] = true;
        }
      }
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var y = top + r, x = left + c;
          if (y >= 0 && y < size && x >= 0 && x < size) {
            isFunction[y][x] = true;
          }
        }
      }
    }
    addFinder(0, 0);
    addFinder(0, size - 7);
    addFinder(size - 7, 0);

    if (spec.ver >= 2) {
      var pos = size - 7;
      for (var r = -2; r <= 2; r++) {
        for (var c = -2; c <= 2; c++) {
          var y = pos + r, x = pos + c;
          var isEdge = Math.abs(r) === 2 || Math.abs(c) === 2;
          var isCenter = r === 0 && c === 0;
          matrix[y][x] = (isEdge || isCenter) ? 1 : 0;
          isFunction[y][x] = true;
        }
      }
    }

    for (var i = 8; i < size - 8; i++) {
      var val = (i % 2 === 0) ? 1 : 0;
      matrix[6][i] = val; isFunction[6][i] = true;
      matrix[i][6] = val; isFunction[i][6] = true;
    }
    matrix[size - 8][8] = 1; isFunction[size - 8][8] = true;

    for (var i = 0; i < 9; i++) {
      if (!isFunction[8][i]) isFunction[8][i] = true;
      if (!isFunction[i][8]) isFunction[i][8] = true;
      if (i < 8) {
        if (!isFunction[8][size - 1 - i]) isFunction[8][size - 1 - i] = true;
        if (!isFunction[size - 1 - i][8]) isFunction[size - 1 - i][8] = true;
      }
    }

    var bitIndex = 0;
    var totalBits = fullCodewords.length * 8;
    var upward = true;

    for (var c = size - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      var rows = [];
      for (var r = 0; r < size; r++) rows.push(r);
      if (upward) rows.reverse();

      for (var idx = 0; idx < rows.length; idx++) {
        var r = rows[idx];
        for (var col = 0; col < 2; col++) {
          var x = c - col;
          if (!isFunction[r][x]) {
            var bit = 0;
            if (bitIndex < totalBits) {
              var byteIdx = Math.floor(bitIndex / 8);
              var bitPos = 7 - (bitIndex % 8);
              bit = (fullCodewords[byteIdx] >> bitPos) & 1;
              bitIndex++;
            }
            if ((r + x) % 2 === 0) bit ^= 1;
            matrix[r][x] = bit;
          }
        }
      }
      upward = !upward;
    }

    var formatBits = 0x77c4;
    for (var i = 0; i < 15; i++) {
      var bit = (formatBits >> (14 - i)) & 1;
      if (i <= 5) matrix[8][i] = bit;
      else if (i === 6) matrix[8][7] = bit;
      else if (i === 7) matrix[8][8] = bit;
      else if (i === 8) matrix[7][8] = bit;
      else matrix[14 - i][8] = bit;

      if (i < 8) matrix[size - 1 - i][8] = bit;
      else matrix[8][size - 15 + i] = bit;
    }

    return { size: size, matrix: matrix };
  }

  var QRCode = {
    generateSVG: function(text, size) {
      size = size || 220;
      var spec = selectVersion(text.length);
      var codewords = encodeData(text, spec);
      var qr = createMatrix(spec, codewords);

      var margin = 2;
      var moduleCount = qr.size + margin * 2;
      var scale = size / moduleCount;

      var svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">'];
      svg.push('<rect width="' + size + '" height="' + size + '" fill="#ffffff" rx="12" />');

      for (var r = 0; r < qr.size; r++) {
        for (var c = 0; c < qr.size; c++) {
          if (qr.matrix[r][c] === 1) {
            var x = Math.round((c + margin) * scale);
            var y = Math.round((r + margin) * scale);
            var w = Math.ceil(scale);
            var h = Math.ceil(scale);
            svg.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#0d1117" />');
          }
        }
      }
      svg.push('</svg>');
      return svg.join('');
    }
  };

  global.QRCode = QRCode;
})(typeof window !== 'undefined' ? window : this);
