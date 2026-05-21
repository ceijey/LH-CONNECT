'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import styles from './ChatBox.module.css';

export interface ChatThreadItem {
  id: string;
  title: string;
  meta?: string;
  preview?: string;
  timestamp?: string;
  status?: string;
  unread?: boolean;
}

export interface ChatConversationItem {
  id: string;
  sender: string;
  content: string;
  timestamp?: string;
  align?: 'left' | 'right';
  imageUrl?: string;
}

interface ChatBoxProps {
  title: string;
  subtitle?: string;
  threads: ChatThreadItem[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  conversation: ChatConversationItem[];
  replyValue: string;
  onReplyChange: (value: string) => void;
  onSendReply: () => void | Promise<void>;
  sendLabel?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void | Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  composerPlaceholder?: string;
  selectedImage?: File | null;
  onImageSelect?: (file: File | null) => void;
}

export default function ChatBox({
  title,
  subtitle,
  threads,
  selectedThreadId,
  onSelectThread,
  conversation,
  replyValue,
  onReplyChange,
  onSendReply,
  sendLabel = 'Send',
  secondaryActionLabel,
  onSecondaryAction,
  isLoading = false,
  error = null,
  emptyMessage = 'No messages yet.',
  composerPlaceholder = 'Write a message...',
  selectedImage,
  onImageSelect,
}: ChatBoxProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation, selectedThreadId]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxSrc) return;
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSrc(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [lightboxSrc]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void onSendReply();
    }
  };

  return (
    <section className={styles.shell} aria-label={title}>
      {/* ===== Lightbox Overlay ===== */}
      {lightboxSrc && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxSrc(null)}>
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={(e) => { e.stopPropagation(); setLightboxSrc(null); }}
            aria-label="Close preview"
          >
            ✕
          </button>
          <img
            src={lightboxSrc}
            alt="Full preview"
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          <span className={styles.count}>{threads.length}</span>
        </div>

        <div className={styles.threadList}>
          {isLoading ? (
            <div className={styles.emptyState}>Loading messages...</div>
          ) : error ? (
            <div className={styles.errorState}>{error}</div>
          ) : threads.length === 0 ? (
            <div className={styles.emptyState}>{emptyMessage}</div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`${styles.threadItem} ${selectedThreadId === thread.id ? styles.threadItemActive : ''} ${thread.unread ? styles.threadItemUnread : ''}`}
                onClick={() => onSelectThread(thread.id)}
              >
                <div className={styles.threadTopRow}>
                  <div>
                    <div className={styles.threadTitle}>{thread.title}</div>
                    {thread.meta ? <div className={styles.threadMeta}>{thread.meta}</div> : null}
                  </div>
                  {thread.status ? <span className={styles.statusPill}>{thread.status}</span> : null}
                </div>
                {thread.preview ? <div className={styles.threadPreview}>{thread.preview}</div> : null}
                {thread.timestamp ? <div className={styles.threadTimestamp}>{thread.timestamp}</div> : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <div className={styles.conversationPane}>
        <div className={styles.conversationHeader}>
          <div>
            <h3 className={styles.conversationTitle}>{selectedThread?.title ?? 'Select a conversation'}</h3>
            {selectedThread?.meta ? <p className={styles.conversationMeta}>{selectedThread.meta}</p> : null}
          </div>
          <div className={styles.conversationActions}>
            {selectedThread?.status ? <span className={styles.statusPill}>{selectedThread.status}</span> : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <button type="button" className={styles.secondaryButton} onClick={() => void onSecondaryAction()}>
                {secondaryActionLabel}
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.messageStream}>
          {selectedThreadId == null ? (
            <div className={styles.emptyConversation}>{emptyMessage}</div>
          ) : conversation.length === 0 ? (
            <div className={styles.emptyConversation}>No message content available.</div>
          ) : (
            conversation.map((message) => {
              const isMine = (message.align ?? 'left') === 'right';

              return (
                <article
                  key={message.id}
                  className={`${styles.bubbleRow} ${isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs}`}
                >
                  <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}>
                    <div className={styles.bubbleSender}>{message.sender}</div>
                    {message.content && <div className={styles.bubbleContent}>{message.content}</div>}
                    {message.imageUrl && (
                      <div
                        className={styles.bubbleImageThumb}
                        onClick={() => setLightboxSrc(message.imageUrl!)}
                        title="Click to view full image"
                      >
                        <img src={message.imageUrl} alt="Attachment" />
                        <div className={styles.thumbOverlay}>
                          <span>🔍 View</span>
                        </div>
                      </div>
                    )}
                    {message.timestamp ? <div className={styles.bubbleTime}>{message.timestamp}</div> : null}
                  </div>
                </article>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.composer}>
          {selectedImage && (
            <div className={styles.imagePreviewWrapper}>
              <span className={styles.imagePreviewName}>📎 {selectedImage.name}</span>
              <button type="button" className={styles.removeImageBtn} onClick={() => onImageSelect?.(null)}>✕</button>
            </div>
          )}
          <textarea
            className={styles.composerInput}
            placeholder={composerPlaceholder}
            value={replyValue}
            onChange={(event) => onReplyChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
          />
          <div className={styles.composerFooter}>
            <p className={styles.composerHint}>Enter sends, Shift+Enter adds a new line.</p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label className={styles.attachBtn} title="Attach Image">
                📎
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0] && onImageSelect) {
                      onImageSelect(e.target.files[0]);
                    }
                    e.target.value = ''; // Reset input
                  }}
                />
              </label>
              <button
                type="button"
                className={styles.sendButton}
                onClick={() => void onSendReply()}
                disabled={isLoading || !selectedThreadId}
              >
                {sendLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

