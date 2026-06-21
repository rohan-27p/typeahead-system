import crypto from 'node:crypto';

export function hashToInt(value) {
  const digest = crypto.createHash('sha1').update(value).digest();
  return digest.readUInt32BE(0);
}

export class ConsistentHashRing {
  constructor(nodes, virtualNodes = 80) {
    this.virtualNodes = virtualNodes;
    this.ring = [];
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  addNode(node) {
    for (let i = 0; i < this.virtualNodes; i += 1) {
      this.ring.push({
        hash: hashToInt(`${node.id}:${i}`),
        node
      });
    }
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  getNode(key) {
    if (this.ring.length === 0) {
      throw new Error('Hash ring has no nodes.');
    }

    const hash = hashToInt(key);
    let low = 0;
    let high = this.ring.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ring[mid].hash < hash) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const index = low === this.ring.length ? 0 : low;
    return {
      hash,
      node: this.ring[index].node,
      ringPosition: this.ring[index].hash
    };
  }
}
