import React from 'react'
import { Card, Empty, Icon } from './ui.jsx'
import { useFiles, filesFor, describe, urlFor } from './uploads.js'

// Documents and media a planner pinned to this product or material on the
// Connected systems page. Nothing is shown until something has been uploaded.
export default function FilesCard({ type, id }) {
  const mine = filesFor(useFiles(), type, id)
  if (!mine.length) return null
  return (
    <Card title="Files" sub={`${mine.length} uploaded file${mine.length === 1 ? '' : 's'} kept against this ${type}`} pad={false}>
      <div className="doc-grid">
        {mine.map(f => (
          <div key={f.id} className="doc">
            <div className="doc-pic">
              {f.shape === 'image' && urlFor(f)
                ? <span className="up-thumb sm"><img src={urlFor(f)} alt={f.name} /></span>
                : f.shape === 'video' && urlFor(f)
                  ? <video src={urlFor(f)} controls preload="metadata" />
                  : <span className="up-ico"><Icon name="file" size={20} /></span>}
            </div>
            <div className="doc-txt">
              <b>{f.name}</b>
              <div className="note">{describe(f.name, f.size, f.mime)}</div>
              <div className="note">{f.kindLabel}</div>
            </div>
            {urlFor(f) && <a className="btn sm" href={urlFor(f)} target="_blank" rel="noreferrer">View</a>}
          </div>
        ))}
      </div>
    </Card>
  )
}
